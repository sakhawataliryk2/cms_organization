import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get access token from session
    const token = request.cookies.get('msal_access_token')?.value;
    const tokenExpiry = request.cookies.get('msal_access_token_expiry')?.value;

    if (token && tokenExpiry && new Date().getTime() < parseInt(tokenExpiry)) {
      return NextResponse.json({
        accessToken: token,
        expiresIn: Math.floor((parseInt(tokenExpiry) - new Date().getTime()) / 1000),
      });
    }

    // Token expired or not found, return null
    return NextResponse.json(
      { error: 'No valid token found. Please authenticate.' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('Error getting Office 365 token:', error);
    return NextResponse.json(
      { error: 'Failed to get Office 365 token', message: error.message },
      { status: 500 }
    );
  }
}
