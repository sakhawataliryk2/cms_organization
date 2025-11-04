import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Missing or invalid token.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const event = await request.json();

    // Create calendar event using Microsoft Graph API
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendar/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!graphResponse.ok) {
      const error = await graphResponse.json();
      return NextResponse.json(
        { error: 'Failed to create calendar event', message: error.error?.message || 'Unknown error' },
        { status: graphResponse.status }
      );
    }

    const createdEvent = await graphResponse.json();
    return NextResponse.json({ success: true, event: createdEvent });
  } catch (error: any) {
    console.error('Error syncing calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to sync calendar event', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Missing or invalid token.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const searchParams = request.nextUrl.searchParams;
    const startDateTime = searchParams.get('startDateTime');
    const endDateTime = searchParams.get('endDateTime');

    // Build Graph API URL
    let graphUrl = 'https://graph.microsoft.com/v1.0/me/calendar/calendarView';
    const params = new URLSearchParams();
    if (startDateTime) params.append('startDateTime', startDateTime);
    if (endDateTime) params.append('endDateTime', endDateTime);
    if (params.toString()) graphUrl += `?${params.toString()}`;

    // Fetch calendar events from Microsoft Graph API
    const graphResponse = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Prefer': 'outlook.timezone="UTC"',
      },
    });

    if (!graphResponse.ok) {
      const error = await graphResponse.json();
      return NextResponse.json(
        { error: 'Failed to fetch calendar events', message: error.error?.message || 'Unknown error' },
        { status: graphResponse.status }
      );
    }

    const data = await graphResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events', message: error.message },
      { status: 500 }
    );
  }
}
