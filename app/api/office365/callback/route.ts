import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * OAuth callback handler for Office 365 authentication
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle error from OAuth
    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/planner?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/planner?error=No authorization code received', request.url)
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_MS_CLIENT_ID || '',
        scope: 'Calendars.ReadWrite Mail.Send User.Read',
        code: code,
        redirect_uri: `${request.nextUrl.origin}/api/office365/callback`,
        grant_type: 'authorization_code',
        client_secret: process.env.MS_CLIENT_SECRET || '',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      return NextResponse.redirect(
        new URL(
          `/dashboard/planner?error=${encodeURIComponent(errorData.error_description || 'Failed to authenticate')}`,
          request.url
        )
      );
    }

    const tokenData = await tokenResponse.json();
    const expiresIn = tokenData.expires_in || 3600;
    const expiryTime = new Date().getTime() + (expiresIn * 1000);

    // Store tokens in cookies (also set in sessionStorage via client-side)
    const cookieStore = await cookies();
    cookieStore.set('msal_access_token', tokenData.access_token, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });

    cookieStore.set('msal_access_token_expiry', expiryTime.toString(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });

    if (tokenData.refresh_token) {
      cookieStore.set('msal_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90, // 90 days
        path: '/',
      });
    }

    // Redirect back to planner with success message
    return NextResponse.redirect(
      new URL('/dashboard/planner?connected=true', request.url)
    );
  } catch (error: any) {
    console.error('Error in Office 365 callback:', error);
    return NextResponse.redirect(
      new URL(
        `/dashboard/planner?error=${encodeURIComponent(error.message || 'Authentication failed')}`,
        request.url
      )
    );
  }
}
