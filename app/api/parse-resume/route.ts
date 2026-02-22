import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractTextFromFile, isResumeFile } from "@/lib/resumeTextExtract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "stepfun/step-3.5-flash:free";

// Enable debug mode with RESUME_PARSER_DEBUG=true in .env
const DEBUG = process.env.RESUME_PARSER_DEBUG === "true";
function debugLog(label: string, data?: unknown) {
  if (!DEBUG) return;
  console.log(`\n[RESUME-PARSER] ${label}`);
  if (data !== undefined) console.dir(data, { depth: 5 });
}

type CustomFieldDef = {
  field_name: string;
  field_label?: string | null;
  field_type?: string | null;
  is_hidden?: boolean;
  options?: string[] | string | Record<string, unknown> | null;
};

type FieldMeta = {
  name: string;
  type: string;
  options: string[];
};

const BASE_SYSTEM_PROMPT = `You are an intelligent resume parsing and field-normalization engine.

Your job has TWO responsibilities:

STEP 1 — Extract Data
Extract structured information from the resume and return clean, normalized JSON that matches the schema exactly.

STEP 2 — Match Selectable Fields
For fields that are SELECT or RADIO type (with provided allowed options):
1. Compare the extracted resume value against the provided allowed options list.
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
- Phone numbers: normalize to (XXX) XXX-XXXX format for US numbers.
- Emails: return as-is if valid.

ADDRESS PARSING:
- Split location/address into components:
  - "address": street line 1
  - "address_2": line 2 if any
  - "city": city
  - "state": 2-letter code
  - "zip": postal code
- If only one line like "San Francisco, CA", put city in "city" and state in "state".
`;

function normalizeOptions(opts: unknown): string[] {
  if (!opts) return [];
  if (Array.isArray(opts)) return opts.filter((o) => typeof o === "string").map((o) => String(o).trim());
  if (typeof opts === "string") {
    try {
      const p = JSON.parse(opts);
      if (Array.isArray(p)) return normalizeOptions(p);
      return opts.split(/\r?\n/).map((o) => o.trim()).filter(Boolean);
    } catch {
      return opts.split(/\r?\n/).map((o) => o.trim()).filter(Boolean);
    }
  }
  if (typeof opts === "object") return Object.values(opts).filter((o) => typeof o === "string").map((o) => String(o).trim());
  return [];
}

function buildSystemPrompt(customFields: CustomFieldDef[]): string {
  const visible = customFields.filter((f) => !f.is_hidden && f.field_name);
  const selectFields: Array<{ name: string; label: string; options: string[] }> = [];
  const textFields: Array<{ name: string; label: string }> = [];

  for (const f of visible) {
    const opts = normalizeOptions(f.options);
    const label = (f.field_label || f.field_name).replace(/"/g, "'");
    const type = (f.field_type || "text").toLowerCase();
    if ((type === "select" || type === "radio") && opts.length > 0) {
      selectFields.push({ name: f.field_name, label, options: opts });
    } else {
      textFields.push({ name: f.field_name, label });
    }
  }

  let customFieldEntries = "";
  if (visible.length > 0) {
    const lines: string[] = [];
    for (const f of visible) {
      const sf = selectFields.find((s) => s.name === f.field_name);
      if (sf) {
        lines.push(
          `    "${f.field_name}": ""  // SELECT: ${sf.label}. MUST be exactly one of: [${sf.options
            .map((o) => `"${o}"`)
            .join(", ")}]. Choose closest match or "" if none.`
        );
      } else {
        lines.push(`    "${f.field_name}": ""  // value for: ${(f.field_label || f.field_name).replace(/"/g, "'")}`);
      }
    }
    customFieldEntries = lines.join(",\n");
  }

  const selectBlock =
    selectFields.length > 0
      ? `

SELECTABLE FIELDS — MUST return only allowed values:
${selectFields
  .map(
    (s) =>
      `- "${s.name}" (${s.label}): allowed options = [${s.options.map((o) => `"${o}"`).join(", ")}]. Return exactly one option or "".`
  )
  .join("\n")}

Examples:
- Resume says "Senior Software Engineer" and options include "Senior Level" → return "Senior Level"
- Resume says "full time" and options include "Full-Time" → return "Full-Time"
- Resume says "Freelancer" and options include "Freelance" → return "Freelance"
- No reasonable match → return ""`
      : "";

  const customBlock =
    customFieldEntries.length > 0
      ? `,
  "custom_fields": {
${customFieldEntries}
  }`
      : "";

  return `${BASE_SYSTEM_PROMPT}${selectBlock}

Return JSON in this exact structure:
{
  "full_name": "",
  "first_name": "",
  "last_name": "",
  "email": "",
  "phone": "",
  "mobile_phone": "",
  "address": "",
  "address_2": "",
  "city": "",
  "state": "",
  "zip": "",
  "location": "",
  "linkedin": "",
  "portfolio": "",
  "current_job_title": "",
  "total_experience_years": "",
  "skills": [],
  "education": [
    { "degree": "", "institution": "", "year": "" }
  ],
  "work_experience": [
    { "company": "", "job_title": "", "start_date": "", "end_date": "", "description": "" }
  ]${customBlock}
}
If a section does not exist, return an empty array.`;
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

// ---------------- Semantic Option Matching ----------------
function normalizeStr(v: string): string {
  return v.toLowerCase().replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
}

function semanticIncludes(a: string, b: string): boolean {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  return na.includes(nb) || nb.includes(na);
}

function findClosestOption(value: string, options: string[]): string | null {
  if (!value || options.length === 0) return null;
  const normalizedValue = normalizeStr(value);

  // Exact match
  for (const opt of options) {
    if (normalizeStr(opt) === normalizedValue) return opt;
  }

  // Inclusion match
  for (const opt of options) {
    if (semanticIncludes(normalizedValue, opt)) return opt;
  }

  // Option contains the full value (e.g. "full" → "Full-Time")
  for (const opt of options) {
    if (normalizeStr(opt).includes(normalizedValue)) return opt;
  }

  return null;
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

// ---------------- Fetch Custom Fields ----------------
async function fetchJobSeekerCustomFields(token: string): Promise<CustomFieldDef[]> {
  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
  const res = await fetch(`${apiUrl}/api/custom-fields/entity/job-seekers`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list = data?.customFields ?? data?.data ?? [];
  return Array.isArray(list)
    ? list.filter((f: unknown) => f && typeof f === "object" && typeof (f as CustomFieldDef).field_name === "string")
    : [];
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
        { role: "user", content: `Extract structured information from the following resume text:\n\n${extractedText}` },
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
    if (!token) return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    if (!isResumeFile(file.name, file.type))
      return NextResponse.json({ success: false, message: "Unsupported format. Use PDF, DOCX, or TXT." }, { status: 400 });

    const text = await extractTextFromFile(file);
    if (!text || !text.trim()) return NextResponse.json({ success: false, message: "Could not extract text." }, { status: 400 });

    const customFields = await fetchJobSeekerCustomFields(token);
    const visibleFields = customFields.filter((f) => !f.is_hidden && f.field_name);
    const customFieldNames = visibleFields.map((f) => f.field_name);
    const selectFieldMeta: FieldMeta[] = visibleFields
      .filter((f) => {
        const t = (f.field_type || "text").toLowerCase();
        return (t === "select" || t === "radio") && normalizeOptions(f.options).length > 0;
      })
      .map((f) => ({ name: f.field_name, type: (f.field_type || "text").toLowerCase(), options: normalizeOptions(f.options) }));

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