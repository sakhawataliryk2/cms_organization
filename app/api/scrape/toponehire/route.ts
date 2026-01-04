import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface ScrapedLead {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    title?: string;
    organization?: string;
    location?: string;
    linkedinUrl?: string;
    source: string;
    rawData?: any;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, searchQuery, maxResults = 50 } = body;

        // Get the token from cookies
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        // For now, we'll create a proxy endpoint that calls the backend
        // The backend will handle the actual scraping
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        
        const response = await fetch(`${apiUrl}/api/scrape/toponehire`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                url: url || 'https://toponehire.com',
                searchQuery,
                maxResults
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to scrape data' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error scraping Toponehire:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

