import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractTextFromFile, isResumeFile } from "@/lib/resumeTextExtract";
import {
  CustomFieldDef,
  FieldMeta,
  buildCustomFieldMeta,
  buildCustomFieldPromptInfo,
  fetchEntityCustomFields,
  findClosestOption,
  normalizeStr,
} from "@/lib/aiParsing";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "stepfun/step-3.5-flash:free";

const DEBUG = process.env.JOB_PARSER_DEBUG === "true";
function debugLog(label: string, data?: unknown) {
  if (!DEBUG) return;
  console.log(`\n[JOB-PARSER] ${label}`);
  if (data !== undefined) console.dir(data, { depth: 5 });
}

const BASE_SYSTEM_PROMPT = `You are an intelligent job order parsing and field-normalization engine.

Your job has TWO responsibilities:

STEP 1 — Extract Data
Extract structured information from the job order / job description and return clean, normalized JSON that matches the schema exactly.

STEP 2 — Match Selectable Fields
For fields that are SELECT or RADIO type (with provided allowed options):
1. Compare the extracted value against the provided allowed options list.
2. Return ONLY one value from the allowed options.
3. Choose the closest semantic match.
4. If an exact match exists → return exact match.
5. If no exact match exists → return the most semantically similar option.
6. If nothing reasonably matches → return "" (empty string).
7. Never invent new values for select fields.

General Rules:
- Return ONLY valid JSON. No markdown, no explanation, no text before or after.
- If a field is missing, return "" for string fields, [] for list fields.
- Never invent data. Only extract information present in the text.
- Non-select fields: clean, trimmed values.
- Dates: ISO format (YYYY-MM-DD) if possible.
- Salary / rate: return numeric values as plain strings without currency symbols; use a separate currency field if available.

LOCATION PARSING:
- When possible, split job location into:
  - "city"
  - "state"
  - "country"
- If location is remote, set "remote_or_onsite" appropriately.`;

// ---------------- Helper functions ----------------
function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

function toStrArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean);
  if (typeof v === "string") return v ? v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : [];
  return [];
}

// ---------------- Types ----------------
export interface ParsedJob {
  job_title: string;
  organization_name: string;
  location: string;
  city: string;
  state: string;
  country: string;
  remote_or_onsite: string;
  employment_type: string;
  status: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  experience_level: string;
  min_years_experience: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  job_description: string;
  notes: string;
  custom_fields?: Record<string, string>;
}

// ---------------- Build system prompt ----------------
function buildSystemPrompt(customFields: CustomFieldDef[]): string {
  const { selectBlock, customBlock } = buildCustomFieldPromptInfo(customFields);

  return `${BASE_SYSTEM_PROMPT}${selectBlock}

Return JSON in this exact structure:
{
  "job_title": "",
  "organization_name": "",
  "location": "",
  "city": "",
  "state": "",
  "country": "",
  "remote_or_onsite": "",
  "employment_type": "",
  "status": "",
  "salary_min": "",
  "salary_max": "",
  "salary_currency": "",
  "experience_level": "",
  "min_years_experience": "",
  "required_skills": [],
  "nice_to_have_skills": [],
  "job_description": "",
  "notes": ""${customBlock}
}
If a list section does not exist, return an empty array.`;
}

// ---------------- AI JSON Parsing ----------------
function parseJobJson(raw: string, customFieldNames: string[], selectFieldMeta: FieldMeta[]): ParsedJob | null {
  let text = raw.trim();
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) text = codeMatch[1].trim();

  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    debugLog("AI JSON Parsed", obj);

    const required_skills = toStrArray(obj.required_skills);
    const nice_to_have_skills = toStrArray(obj.nice_to_have_skills);

    const rawCustom = obj.custom_fields;
    const parsed =
      rawCustom && typeof rawCustom === "object"
        ? Object.fromEntries(
            Object.entries(rawCustom as Record<string, unknown>).map(([k, v]) => [k, toStr(v)])
          )
        : {};

    const custom_fields: Record<string, string> = {};

    for (const name of customFieldNames) {
      let val = parsed[name] ?? "";
      const meta = selectFieldMeta.find((m) => m.name === name);
      if (meta && meta.options.length > 0) {
        const exact = meta.options.find((o) => normalizeStr(o) === normalizeStr(val));
        if (exact) val = exact;
        else if (val) {
          const closest = findClosestOption(val, meta.options);
          val = closest ?? "";
        }
      }
      if (val) custom_fields[name] = val;
    }

    return {
      job_title: toStr(obj.job_title),
      organization_name: toStr(obj.organization_name),
      location: toStr(obj.location),
      city: toStr(obj.city),
      state: toStr(obj.state),
      country: toStr(obj.country),
      remote_or_onsite: toStr(obj.remote_or_onsite),
      employment_type: toStr(obj.employment_type),
      status: toStr(obj.status),
      salary_min: toStr(obj.salary_min),
      salary_max: toStr(obj.salary_max),
      salary_currency: toStr(obj.salary_currency),
      experience_level: toStr(obj.experience_level),
      min_years_experience: toStr(obj.min_years_experience),
      required_skills,
      nice_to_have_skills,
      job_description: toStr(obj.job_description),
      notes: toStr(obj.notes),
      custom_fields: Object.keys(custom_fields).length > 0 ? custom_fields : undefined,
    };
  } catch (err) {
    debugLog("Failed to parse AI JSON", raw);
    return null;
  }
}

// ---------------- Call OpenRouter AI ----------------
async function callOpenRouter(extractedText: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract structured information from the following job order / job description text:\n\n${extractedText}`,
        },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter returned no content");

  debugLog("Raw AI Response", content);
  return content;
}

// ---------------- Main POST Route ----------------
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }
    // Reuse resume file validation since job orders are also typically PDF/DOCX/TXT
    if (!isResumeFile(file.name, file.type)) {
      return NextResponse.json(
        { success: false, message: "Unsupported format. Use PDF, DOCX, or TXT." },
        { status: 400 }
      );
    }

    const text = await extractTextFromFile(file);
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, message: "Could not extract text." }, { status: 400 });
    }

    const customFields = await fetchEntityCustomFields("jobs", token);
    const { customFieldNames, selectFieldMeta } = buildCustomFieldMeta(customFields);
    const systemPrompt = buildSystemPrompt(customFields);

    let rawContent = await callOpenRouter(text, systemPrompt);
    let parsed = parseJobJson(rawContent, customFieldNames, selectFieldMeta);

    // Retry once if parse failed
    if (!parsed) {
      debugLog("Retrying AI call due to invalid JSON");
      rawContent = await callOpenRouter(text, systemPrompt);
      parsed = parseJobJson(rawContent, customFieldNames, selectFieldMeta);
    }

    if (!parsed) {
      return NextResponse.json(
        { success: false, message: "AI response was not valid JSON. Enter job details manually." },
        { status: 422 }
      );
    }

    debugLog("Final Parsed Job", parsed);
    return NextResponse.json({ success: true, parsed });
  } catch (e) {
    console.error("Parse job error:", e);
    const message = e instanceof Error ? e.message : "Job parsing failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Use POST to parse a job file." }, { status: 400 });
}

