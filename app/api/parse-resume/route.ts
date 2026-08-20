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
  normalizeOptions,
  normalizeStr,
} from "@/lib/aiParsing";
import { extractUsStateFromText, matchStateToOption } from "@/lib/usStates";
import {
  pickBestOrganizationMatch,
  pickCurrentOrganizationName,
} from "@/lib/resumeOrganizationLookup";
import { ORGANIZATION_LOOKUP_FIELD_BY_ENTITY } from "@/lib/entitySummaryFieldMaps";

const JOB_SEEKER_ORG_FIELD_NAME =
  ORGANIZATION_LOOKUP_FIELD_BY_ENTITY["job-seekers"]; // Field_5
const JOB_SEEKER_STATE_FIELD_NAME = "Field_18";

export const runtime = "nodejs";

/** Cheap paid OpenRouter model (~$0.03 in / $0.13 out per 1M tokens). `:floor` = cheapest provider. */
const MODEL = "openai/gpt-oss-20b:floor";
/** Cap input to cut prompt tokens; contact + recent roles usually fit early. */
const MAX_RESUME_CHARS = 6000;
/** Cap completion size — room for JSON after any residual reasoning. */
const MAX_OUTPUT_TOKENS = 4096;

// Enable debug mode with RESUME_PARSER_DEBUG=true in .env
const DEBUG = process.env.RESUME_PARSER_DEBUG === "true";
function debugLog(label: string, data?: unknown) {
  if (!DEBUG) return;
  console.log(`\n[RESUME-PARSER] ${label}`);
  if (data !== undefined) console.dir(data, { depth: 5 });
}

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
  - "state": 2-letter USPS code (e.g. MA, CA, NY). NEVER leave state empty if a code or full name appears next to the city or ZIP (e.g. "Dracut, MA 01826" → city "Dracut", state "MA", zip "01826").
  - "zip": postal code
- If only one line like "San Francisco, CA", put city in "city" and state in "state".
- Also fill the State custom field (usually Field_18) with the EXACT allowed select option (typically the full name, e.g. "Massachusetts" for MA).

CURRENT ORGANIZATION:
- Identify the candidate's CURRENT / most recent employer (end date "present"/"current", or the latest date range). Do not use an older job when a newer one exists.
- Resume experience headers often look like "AUTOFAIR TOYOTA, TEWKSBURY, MA (2023-present)". In that pattern the company is the text BEFORE the city/state.
- Return the company NAME ONLY in "current_organization" (no city, state, dates, or job title).
- Example: "AUTOFAIR TOYOTA, TEWKSBURY, MA (2023-present)" → current_organization = "AUTOFAIR TOYOTA".
- Leave custom_fields Field_5 empty. A name-based CRM lookup fills Current Organization after parsing.
`;

function buildSystemPrompt(customFields: CustomFieldDef[]): string {
  const promptFields = customFields.filter(
    (f) => f.field_name !== JOB_SEEKER_ORG_FIELD_NAME
  );
  const { selectBlock, customBlock } = buildCustomFieldPromptInfo(promptFields);

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
  "current_organization": "",
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
      if (name === JOB_SEEKER_ORG_FIELD_NAME) continue;
      let val = parsed[name] ?? "";
      const meta = selectFieldMeta.find((m) => m.name === name);
      if (name === JOB_SEEKER_STATE_FIELD_NAME) {
        // State is mapped after parse via USPS code ↔ full-name options.
        if (val) custom_fields[name] = val;
        continue;
      }
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
      current_organization: toStr(obj.current_organization),
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

function applyParsedState(
  parsed: ParsedResume,
  customFields: CustomFieldDef[],
  resumeText?: string
): void {
  const stateDef = customFields.find((f) => f.field_name === JOB_SEEKER_STATE_FIELD_NAME);
  const options = stateDef ? normalizeOptions(stateDef.options) : [];
  const locationBlob = [parsed.address, parsed.address_2, parsed.city, parsed.state, parsed.zip, parsed.location]
    .filter(Boolean)
    .join(", ");

  const extracted =
    extractUsStateFromText(parsed.state) ||
    extractUsStateFromText(locationBlob) ||
    extractUsStateFromText(parsed.custom_fields?.[JOB_SEEKER_STATE_FIELD_NAME]) ||
    extractUsStateFromText(resumeText);

  if (extracted && !parsed.state) parsed.state = extracted.code;

  const matched = matchStateToOption(
    parsed.state || parsed.custom_fields?.[JOB_SEEKER_STATE_FIELD_NAME] || "",
    options,
    `${locationBlob} ${resumeText || ""}`
  );
  if (!matched) return;

  parsed.custom_fields = { ...(parsed.custom_fields || {}), [JOB_SEEKER_STATE_FIELD_NAME]: matched };
  if (!parsed.state) parsed.state = extracted?.code || matched;
}

async function lookupCurrentOrganizationId(
  orgName: string,
  token: string
): Promise<string | null> {
  const q = orgName.trim();
  if (!q) return null;

  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
  const queries = [q];
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 2) queries.push(tokens.slice(0, 2).join(" "));

  for (const query of queries) {
    const url = `${apiUrl}/api/organizations?q=${encodeURIComponent(query)}&limit=50`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) continue;

    const data = (await res.json().catch(() => null)) as {
      organizations?: Array<{ id?: string | number; name?: string; nicknames?: string | null }>;
    } | null;
    const orgs = Array.isArray(data?.organizations) ? data.organizations : [];
    const best = pickBestOrganizationMatch(q, orgs);
    if (best?.id != null) return String(best.id);
  }

  return null;
}

async function applyParsedOrganization(
  parsed: ParsedResume,
  token: string,
  resumeText?: string
): Promise<void> {
  const orgName = pickCurrentOrganizationName(parsed, resumeText);
  if (orgName) parsed.current_organization = orgName;

  const existing = parsed.custom_fields?.[JOB_SEEKER_ORG_FIELD_NAME];
  if (existing && /^\d+$/.test(existing)) return;
  if (!orgName) return;

  try {
    const orgId = await lookupCurrentOrganizationId(orgName, token);
    if (!orgId) return;
    parsed.custom_fields = { ...(parsed.custom_fields || {}), [JOB_SEEKER_ORG_FIELD_NAME]: orgId };
  } catch (err) {
    debugLog("Organization name lookup failed", err);
  }
}

// ---------------- Call OpenRouter (cheap paid model) ----------------
async function callOpenRouter(extractedText: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
      "X-Title": "CMS Resume Parser",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      // gpt-oss is a reasoning model — default reasoning eats the token budget and returns empty content
      reasoning: { effort: "low", exclude: true },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract structured information from the resume text below. Return ONLY valid JSON matching the schema.\n\nRESUME TEXT:\n${extractedText}`,
        },
      ],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    choices?: Array<{
      message?: { content?: string | null; reasoning?: string | null };
      finish_reason?: string;
    }>;
    error?: { message?: string; metadata?: { raw?: string }; code?: number | string };
  };

  if (!res.ok) {
    const detail =
      data?.error?.metadata?.raw ||
      data?.error?.message ||
      `OpenRouter error (${res.status})`;
    console.error("[RESUME-PARSER] OpenRouter error:", JSON.stringify(data?.error ?? data));
    throw new Error(typeof detail === "string" ? detail.slice(0, 500) : "OpenRouter provider error");
  }

  const message = data?.choices?.[0]?.message;
  const content = (message?.content ?? "").trim();
  if (!content) {
    console.error(
      "[RESUME-PARSER] Empty content from OpenRouter:",
      JSON.stringify({
        finish_reason: data?.choices?.[0]?.finish_reason,
        has_reasoning: Boolean(message?.reasoning),
        message_keys: message ? Object.keys(message) : [],
      })
    );
    throw new Error("OpenRouter returned no content");
  }

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

    const rawExtractedText = await extractTextFromFile(file);
    if (!rawExtractedText || !rawExtractedText.trim()) return NextResponse.json({ success: false, message: "Could not extract text." }, { status: 400 });

    const text = rawExtractedText
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[^\x00-\x7F\n]/g, "")
      .trim()
      .slice(0, MAX_RESUME_CHARS);

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

    applyParsedState(parsed, customFields, text);
    await applyParsedOrganization(parsed, token, text);

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
  current_organization: string;
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