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

export const runtime = "nodejs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "stepfun/step-3.5-flash:free";

// Enable debug mode with RESUME_PARSER_DEBUG=true in .env
const DEBUG = process.env.RESUME_PARSER_DEBUG === "true";
function debugLog(label: string, data?: unknown) {
  if (!DEBUG) return;
  console.log(`\n[RESUME-PARSER] ${label}`);
  if (data !== undefined) console.dir(data, { depth: 5 });
}

const BASE_SYSTEM_PROMPT = `You are a high speed document data extraction engine.

Your task is to extract values from the provided document text and map them to the given fields.

Rules:
- Return ONLY valid JSON.
- Do not include explanations.
- Do not include markdown.
- If a value cannot be found return null.
- Never invent or guess data.
- Match the field names exactly.
- Output must be under 300 tokens.`;

function optimizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 3500);
}

function buildRegexPreExtraction(text: string): {
  email: string | null;
  phone: string | null;
  linkedin: string | null;
} {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phoneMatch = text.match(/\+?\d[\d\s\-()]{7,}/)?.[0] ?? null;
  const linkedinMatch = text.match(/linkedin\.com\/[^\s]+/i)?.[0] ?? null;
  return {
    email: emailMatch,
    phone: phoneMatch,
    linkedin: linkedinMatch,
  };
}

function buildSystemPrompt(customFields: CustomFieldDef[]): string {
  const { selectBlock, customBlock } = buildCustomFieldPromptInfo(customFields);

  const fieldSchema: Record<string, string> = {
    full_name: "string",
    first_name: "string",
    last_name: "string",
    email: "string",
    phone: "string",
    mobile_phone: "string",
    address: "string",
    address_2: "string",
    city: "string",
    state: "string",
    zip: "string",
    location: "string",
    linkedin: "string",
    portfolio: "string",
    current_job_title: "string",
    total_experience_years: "string",
    skills: "string[]",
    education: "string",
    work_experience: "string",
  };

  for (const f of customFields) {
    fieldSchema[f.field_name] = "string";
  }

  const schemaJson = JSON.stringify(fieldSchema, null, 2);

  return `${BASE_SYSTEM_PROMPT}

Fields Schema:
${schemaJson}

Additional rules for selectable fields:
- For fields that are SELECT or RADIO type (with provided allowed options), only return one value from the allowed options list.
- If no reasonable match exists, return null for that field.

Selectable field options (for reference only, do not repeat in output):
${selectBlock}${customBlock}`;
}

// ---------------- Helper functions ----------------
function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

function toStrArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean);
  if (typeof v === "string") return v ? [v.trim()] : [];
  return [];
}

function toCustomFieldsRecord(v: unknown): Record<string, string> {
  if (v == null || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof k === "string" && val != null) out[k] = toStr(val);
  }
  return out;
}

// ---------------- AI JSON Parsing ----------------
function parseAiJson(raw: string, customFieldNames: string[], selectFieldMeta: FieldMeta[]): ParsedResume | null {
  let text = raw.trim();
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) text = codeMatch[1].trim();

  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    debugLog("AI JSON Parsed", obj);

    const education = Array.isArray(obj.education)
      ? (obj.education as Array<Record<string, unknown>>).map((e) => ({
          degree: toStr(e?.degree),
          institution: toStr(e?.institution),
          year: toStr(e?.year),
        }))
      : [];

    const work_experience = Array.isArray(obj.work_experience)
      ? (obj.work_experience as Array<Record<string, unknown>>).map((w) => ({
          company: toStr(w?.company),
          job_title: toStr(w?.job_title),
          start_date: toStr(w?.start_date),
          end_date: toStr(w?.end_date),
          description: toStr(w?.description),
        }))
      : [];

    let address = toStr(obj.address);
    let address_2 = toStr(obj.address_2);
    let city = toStr(obj.city);
    let state = toStr(obj.state);
    let zip = toStr(obj.zip);
    let location = toStr(obj.location);
    if (!address && !city && !state && !zip && location) address = location;

    const rawCustom = obj.custom_fields;
    const parsed = rawCustom && typeof rawCustom === "object" ? toCustomFieldsRecord(rawCustom) : {};
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
      full_name: toStr(obj.full_name),
      first_name: toStr(obj.first_name),
      last_name: toStr(obj.last_name),
      email: toStr(obj.email),
      phone: toStr(obj.phone),
      mobile_phone: toStr(obj.mobile_phone),
      address,
      address_2,
      city,
      state,
      zip,
      location,
      linkedin: toStr(obj.linkedin),
      portfolio: toStr(obj.portfolio),
      current_job_title: toStr(obj.current_job_title),
      total_experience_years: toStr(obj.total_experience_years),
      skills: toStrArray(obj.skills),
      education,
      work_experience,
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

  const optimized = optimizeText(extractedText);

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
          content: `Document Text:\n${optimized}`,
        },
      ],
      temperature: 0,
      top_p: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
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
    if (!token) return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    if (!isResumeFile(file.name, file.type))
      return NextResponse.json({ success: false, message: "Unsupported format. Use PDF, DOC, DOCX, or TXT." }, { status: 400 });

    const text = await extractTextFromFile(file);
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, message: "Could not extract text." }, { status: 400 });
    }

    const pre = buildRegexPreExtraction(text);

    const customFields = await fetchEntityCustomFields("job-seekers", token);
    const { customFieldNames, selectFieldMeta } = buildCustomFieldMeta(customFields);
    const systemPrompt = buildSystemPrompt(customFields);

    let rawContent = await callOpenRouter(text, systemPrompt);
    let parsed = parseAiJson(rawContent, customFieldNames, selectFieldMeta);

    // Retry once if parse failed
    if (!parsed) {
      debugLog("Retrying AI call due to invalid JSON");
      rawContent = await callOpenRouter(text, systemPrompt);
      parsed = parseAiJson(rawContent, customFieldNames, selectFieldMeta);
    }

    if (!parsed) {
      return NextResponse.json(
        { success: false, message: "AI response was not valid JSON. Enter candidate manually." },
        { status: 422 }
      );
    }

    if (!parsed.email && pre.email) parsed.email = pre.email;
    if (!parsed.phone && pre.phone) parsed.phone = pre.phone;
    if (!parsed.linkedin && pre.linkedin) parsed.linkedin = pre.linkedin;

    debugLog("Final Parsed Resume", parsed);
    return NextResponse.json({ success: true, parsed });
  } catch (e) {
    console.error("Parse resume error:", e);
    const message = e instanceof Error ? e.message : "Resume parsing failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Use POST to parse a resume file." }, { status: 400 });
}

// ---------------- Types ----------------
export interface ParsedResume {
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile_phone: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip: string;
  location: string;
  linkedin: string;
  portfolio: string;
  current_job_title: string;
  total_experience_years: string;
  skills: string[];
  education: Array<{ degree: string; institution: string; year: string }>;
  work_experience: Array<{
    company: string;
    job_title: string;
    start_date: string;
    end_date: string;
    description: string;
  }>;
  custom_fields?: Record<string, string>;
}