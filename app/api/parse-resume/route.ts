import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractTextFromFile, isResumeFile } from "@/lib/resumeTextExtract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "stepfun/step-3.5-flash:free";

type CustomFieldDef = { field_name: string; field_label?: string | null; is_hidden?: boolean };

const BASE_SYSTEM_PROMPT = `You are a resume parsing engine.
Your task is to extract structured candidate information from resume text and return ONLY valid JSON.

Rules:
- Return ONLY valid JSON.
- Do NOT include markdown.
- Do NOT include explanation.
- Do NOT include text before or after JSON.
- If a field is missing, return "" for string fields.
- If a list field has no data, return [].
- Never invent data.
- Never guess.
- Only extract information present in the text.

ADDRESS PARSING (important):
- When you see a location or full address, split it into components:
  - "address": street address (line 1 only, e.g. "123 Main St").
  - "address_2": second line if present (apartment, suite, floor, unit, building).
  - "city": city name only.
  - "state": state (prefer 2-letter US code, e.g. "CA").
  - "zip": ZIP or postal code only.
- If only one line is given (e.g. "San Francisco, CA"), put city in "city", state in "state", leave "address" empty or put the full string in "address" only if it looks like a street.
- Do not put the entire address in a single field; always try to split into address, city, state, zip.`;

function buildSystemPrompt(customFields: CustomFieldDef[]): string {
  const customFieldEntries =
    customFields.length > 0
      ? customFields
          .filter((f) => !f.is_hidden && f.field_name)
          .map(
            (f) =>
              `    "${f.field_name}": ""  // value for: ${(f.field_label || f.field_name).replace(/"/g, "'")}`
          )
          .join(",\n")
      : "";

  const customBlock =
    customFieldEntries.length > 0
      ? `,
  "custom_fields": {
${customFieldEntries}
  }`
      : "";

  return `${BASE_SYSTEM_PROMPT}

Return JSON in this exact structure (use exact keys; put extracted value for each custom_fields key):
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
    {
      "degree": "",
      "institution": "",
      "year": ""
    }
  ],
  "work_experience": [
    {
      "company": "",
      "job_title": "",
      "start_date": "",
      "end_date": "",
      "description": ""
    }
  ]${customBlock}
}
If a section does not exist, return an empty array.`;
}

export interface ParsedResume {
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile_phone: string;
  /** Street address (line 1) */
  address: string;
  /** Address line 2 (apt, suite, etc.) */
  address_2: string;
  city: string;
  state: string;
  zip: string;
  /** Fallback full location if not split */
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
  /** Values keyed by admin field_name for custom fields */
  custom_fields?: Record<string, string>;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

function toStrArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => toStr(x)).filter(Boolean);
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

function parseAiJson(
  raw: string,
  customFieldNames: string[]
): ParsedResume | null {
  let text = raw.trim();
  const codeMatch = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/m);
  if (codeMatch) text = codeMatch[1].trim();
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
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
    if (!address && !city && !state && !zip && location) {
      address = location;
    }

    const custom_fields: Record<string, string> = {};
    const rawCustom = obj.custom_fields;
    if (rawCustom && typeof rawCustom === "object") {
      const parsed = toCustomFieldsRecord(rawCustom);
      for (const name of customFieldNames) {
        if (parsed[name] !== undefined) custom_fields[name] = parsed[name];
      }
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
  } catch {
    return null;
  }
}

async function fetchJobSeekerCustomFields(
  token: string
): Promise<CustomFieldDef[]> {
  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
  const res = await fetch(
    `${apiUrl}/api/custom-fields/entity/job-seekers`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const list = data?.customFields ?? data?.data ?? [];
  return Array.isArray(list)
    ? list.filter(
        (f: unknown) =>
          f && typeof f === "object" && typeof (f as CustomFieldDef).field_name === "string"
      )
    : [];
}

async function callOpenRouter(
  extractedText: string,
  systemPrompt: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env to use AI resume parsing."
    );
  }

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
          content: `Extract structured information from the following resume text:\n\n${extractedText}`,
        },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter returned no content");
  }
  return content;
}

/**
 * POST /api/parse-resume
 * Body: multipart/form-data with "file" (PDF, DOCX, or TXT).
 * Returns { success: true, parsed: ParsedResume } or { success: false, message }.
 * Parsed shape includes address (street), address_2, city, state, zip and custom_fields from admin.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.size) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }
    if (!isResumeFile(file.name, file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Unsupported format. Use PDF, DOCX, or TXT.",
        },
        { status: 400 }
      );
    }

    const text = await extractTextFromFile(file);
    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, message: "Could not extract text from file." },
        { status: 400 }
      );
    }

    const customFields = await fetchJobSeekerCustomFields(token);
    const systemPrompt = buildSystemPrompt(customFields);
    const customFieldNames = customFields
      .filter((f) => !f.is_hidden && f.field_name)
      .map((f) => f.field_name);

    let rawContent = await callOpenRouter(text, systemPrompt);
    let parsed = parseAiJson(rawContent, customFieldNames);

    if (!parsed) {
      rawContent = await callOpenRouter(text, systemPrompt);
      parsed = parseAiJson(rawContent, customFieldNames);
    }

    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "AI response was not valid JSON. Please try again or enter the candidate manually.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, parsed });
  } catch (e) {
    console.error("Parse resume error:", e);
    const message =
      e instanceof Error ? e.message : "Resume parsing failed.";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, message: "Use POST to parse a resume file." },
    { status: 400 }
  );
}
