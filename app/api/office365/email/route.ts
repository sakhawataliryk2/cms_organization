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
    const message = await request.json();

    // Prepare email message for Microsoft Graph API
    const emailMessage = {
      message: {
        subject: message.subject,
        body: {
          contentType: message.bodyType === 'html' ? 'HTML' : 'Text',
          content: message.body,
        },
        toRecipients: message.to.map((email: string) => ({
          emailAddress: {
            address: email,
          },
        })),
        attachments: message.attachments?.map((att: any) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.name,
          contentBytes: att.contentBytes,
          contentType: att.contentType,
        })) || [],
      },
      saveToSentItems: true,
    };

    // Send email using Microsoft Graph API
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailMessage),
    });

    if (!graphResponse.ok) {
      const error = await graphResponse.json();
      return NextResponse.json(
        { error: 'Failed to send email', message: error.error?.message || 'Unknown error' },
        { status: graphResponse.status }
      );
    }

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email', message: error.message },
      { status: 500 }
    );
  }
}
