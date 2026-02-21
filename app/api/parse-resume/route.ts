import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractTextFromFile, isResumeFile } from "@/lib/resumeTextExtract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "stepfun/step-3.5-flash:free";

const SYSTEM_PROMPT = `You are a resume parsing engine.
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

Return JSON in this exact structure:
{
  "full_name": "",
  "first_name": "",
  "last_name": "",
  "email": "",
  "phone": "",
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
  ]
}
If a section does not exist, return an empty array.`;

export interface ParsedResume {
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
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

function parseAiJson(raw: string): ParsedResume | null {
  let text = raw.trim();
  // Strip markdown code block if present
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
    return {
      full_name: toStr(obj.full_name),
      first_name: toStr(obj.first_name),
      last_name: toStr(obj.last_name),
      email: toStr(obj.email),
      phone: toStr(obj.phone),
      location: toStr(obj.location),
      linkedin: toStr(obj.linkedin),
      portfolio: toStr(obj.portfolio),
      current_job_title: toStr(obj.current_job_title),
      total_experience_years: toStr(obj.total_experience_years),
      skills: toStrArray(obj.skills),
      education,
      work_experience,
    };
  } catch {
    return null;
  }
}

async function callOpenRouter(extractedText: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to .env to use AI resume parsing.");
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
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract structured information from the following resume text:\n\n${extractedText}`,
        },
      ],
      temperature: 0,
      // StepFun does not support response_format.json_object; prompt enforces JSON-only output
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
 * Never auto-saves; frontend maps parsed data into the add form for review.
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

    let rawContent = await callOpenRouter(text);
    let parsed = parseAiJson(rawContent);

    // Retry once if JSON parsing failed (e.g. model added commentary)
    if (!parsed) {
      rawContent = await callOpenRouter(text);
      parsed = parseAiJson(rawContent);
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
