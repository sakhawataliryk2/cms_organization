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

const DEBUG = process.env.ORG_PARSER_DEBUG === "true";
function debugLog(label: string, data?: unknown) {
  if (!DEBUG) return;
  console.log(`\n[ORG-PARSER] ${label}`);
  if (data !== undefined) console.dir(data, { depth: 5 });
}

const BASE_SYSTEM_PROMPT = `You are an intelligent organization/company parsing and field-normalization engine.

Your job has TWO responsibilities:

STEP 1 — Extract Data
Extract structured information from the organization profile / document and return clean, normalized JSON that matches the schema exactly.

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
- Phone numbers: normalize to (XXX) XXX-XXXX format for US numbers when possible.

ADDRESS PARSING:
- When possible, split organization address into:
  - "address": street line 1
  - "address_2": line 2 if any
  - "city": city
  - "state": 2-letter code (for US/Canada)
  - "zip": postal code
  - "country": country name or code.`;

// ---------------- Helper functions ----------------
function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

// ---------------- Types ----------------
export interface ParsedOrganization {
  name: string;
  nicknames: string;
  parent_organization: string;
  website: string;
  contact_phone: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  status: string;
  overview: string;
  year_founded: string;
  num_employees: string;
  num_offices: string;
  perm_fee: string;
  contract_on_file: string;
  contract_signed_by: string;
  date_contract_signed: string;
  custom_fields?: Record<string, string>;
}

// ---------------- Build system prompt ----------------
function buildSystemPrompt(customFields: CustomFieldDef[]): string {
  const { selectBlock, customBlock } = buildCustomFieldPromptInfo(customFields);

  return `${BASE_SYSTEM_PROMPT}${selectBlock}

Return JSON in this exact structure:
{
  "name": "",
  "nicknames": "",
  "parent_organization": "",
  "website": "",
  "contact_phone": "",
  "address": "",
  "address_2": "",
  "city": "",
  "state": "",
  "zip": "",
  "country": "",
  "status": "",
  "overview": "",
  "year_founded": "",
  "num_employees": "",
  "num_offices": "",
  "perm_fee": "",
  "contract_on_file": "",
  "contract_signed_by": "",
  "date_contract_signed": ""${customBlock}
}
If a section does not exist, return an empty string or empty object as appropriate.`;
}

// ---------------- AI JSON Parsing ----------------
function parseOrganizationJson(
  raw: string,
  customFieldNames: string[],
  selectFieldMeta: FieldMeta[]
): ParsedOrganization | null {
  let text = raw.trim();
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) text = codeMatch[1].trim();

  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    debugLog("AI JSON Parsed", obj);

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
      name: toStr(obj.name),
      nicknames: toStr(obj.nicknames),
      parent_organization: toStr(obj.parent_organization),
      website: toStr(obj.website),
      contact_phone: toStr(obj.contact_phone),
      address: toStr(obj.address),
      address_2: toStr(obj.address_2),
      city: toStr(obj.city),
      state: toStr(obj.state),
      zip: toStr(obj.zip),
      country: toStr(obj.country),
      status: toStr(obj.status),
      overview: toStr(obj.overview),
      year_founded: toStr(obj.year_founded),
      num_employees: toStr(obj.num_employees),
      num_offices: toStr(obj.num_offices),
      perm_fee: toStr(obj.perm_fee),
      contract_on_file: toStr(obj.contract_on_file),
      contract_signed_by: toStr(obj.contract_signed_by),
      date_contract_signed: toStr(obj.date_contract_signed),
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
          content: `Extract structured information from the following organization document:\n\n${extractedText}`,
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

    const customFields = await fetchEntityCustomFields("organizations", token);
    const { customFieldNames, selectFieldMeta } = buildCustomFieldMeta(customFields);
    const systemPrompt = buildSystemPrompt(customFields);

    let rawContent = await callOpenRouter(text, systemPrompt);
    let parsed = parseOrganizationJson(rawContent, customFieldNames, selectFieldMeta);

    if (!parsed) {
      debugLog("Retrying AI call due to invalid JSON");
      rawContent = await callOpenRouter(text, systemPrompt);
      parsed = parseOrganizationJson(rawContent, customFieldNames, selectFieldMeta);
    }

    if (!parsed) {
      return NextResponse.json(
        { success: false, message: "AI response was not valid JSON. Enter organization manually." },
        { status: 422 }
      );
    }

    debugLog("Final Parsed Organization", parsed);
    return NextResponse.json({ success: true, parsed });
  } catch (e) {
    console.error("Parse organization error:", e);
    const message = e instanceof Error ? e.message : "Organization parsing failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Use POST to parse an organization file." }, { status: 400 });
}

