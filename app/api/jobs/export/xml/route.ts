import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const ids = searchParams.get('ids');

        if (!ids) {
            return NextResponse.json(
                { success: false, message: 'No job IDs provided' },
                { status: 400 }
            );
        }

        // Get token from cookies
        const token = request.cookies.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Call backend API
        const response = await fetch(
            `${process.env.API_BASE_URL || 'http://localhost:8080'}/api/jobs/export/xml?ids=${ids}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                return NextResponse.json(error, { status: response.status });
            }
            return NextResponse.json(
                { success: false, message: 'Failed to export jobs' },
                { status: response.status }
            );
        }

        // Get XML content
        const xmlContent = await response.text();

        // Return XML with proper headers
        return new NextResponse(xmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Content-Disposition': `attachment; filename="jobs_export_${Date.now()}.xml"`,
            },
        });
    } catch (error) {
        console.error('Error exporting jobs:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
