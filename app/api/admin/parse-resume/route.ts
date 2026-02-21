import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseResumeText } from './localParser';
import { extractTextFromFile, isResumeFile } from '@/lib/resumeTextExtract';

/**
 * POST: parse resume file locally (free, open-source).
 * Returns { success, result } with result in same shape as external APIs for job-seeker mapping.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !file.size) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    }
    if (!isResumeFile(file.name, file.type)) {
      return NextResponse.json({ success: false, message: 'Unsupported format. Use PDF, DOC, DOCX, TXT, or RTF.' }, { status: 400 });
    }

    const text = await extractTextFromFile(file);
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Could not extract text from file.' }, { status: 400 });
    }

    const result = parseResumeText(text);
    return NextResponse.json({ success: true, result });
  } catch (e) {
    console.error('Parse resume error:', e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Resume parsing failed.' },
      { status: 500 }
    );
  }
}

/** GET: not used with local parser; kept for compatibility. */
export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST to parse a resume file.' }, { status: 400 });
}
