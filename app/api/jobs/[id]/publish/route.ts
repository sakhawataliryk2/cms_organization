// POST /api/jobs/[id]/publish — Distribute job to LinkedIn / Job Board
// Works without credentials; when credentials are added in Settings, posting will complete.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targets = Array.isArray(body?.targets) ? body.targets : ['job_board'];

    const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
    const response = await fetch(`${apiUrl}/api/jobs/${id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targets }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || 'Failed to publish job' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Publish job error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while publishing the job',
        error: process.env.NODE_ENV === 'production' ? undefined : (error as Error).message,
      },
      { status: 500 }
    );
  }
}
