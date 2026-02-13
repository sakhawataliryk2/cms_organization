import { NextRequest, NextResponse } from 'next/server';

// This route exists to prevent Next.js build errors
// The actual export functionality is in /export subroute
export async function GET(request: NextRequest) {
    return NextResponse.json(
        { success: false, message: 'Please use /api/admin/data-downloader/export endpoint' },
        { status: 404 }
    );
}

export async function POST(request: NextRequest) {
    return NextResponse.json(
        { success: false, message: 'Please use /api/admin/data-downloader/export endpoint' },
        { status: 404 }
    );
}
