/**
 * Office 365 Integration Utilities
 * Handles Microsoft Graph API authentication and calendar/email sync
 */

export interface Office365Config {
  clientId: string;
  tenantId: string;
  redirectUri: string;
}

export interface CalendarEvent {
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  body?: {
    contentType: string;
    content: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
    type: string;
  }>;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
  attachments?: Array<{
    name: string;
    contentBytes: string;
    contentType: string;
  }>;
}

/**
 * Initialize Office 365 authentication via Microsoft Graph
 */
export const initializeOffice365Auth = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if MSAL is available
    if (typeof window === 'undefined') {
      reject(new Error('Browser environment required'));
      return;
    }

    // Use Microsoft Graph auth endpoint
    const msalConfig = {
      auth: {
        clientId: process.env.NEXT_PUBLIC_MS_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MS_TENANT_ID || 'common'}`,
        redirectUri: typeof window !== 'undefined' ? window.location.origin + '/api/office365/callback' : '',
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    };

    // Check if already authenticated
    const accessToken = sessionStorage.getItem('msal_access_token');
    if (accessToken) {
      resolve();
      return;
    }

    // Redirect to Microsoft login
    const scopes = ['Calendars.ReadWrite', 'Mail.Send', 'User.Read'];
    const loginUrl = `https://login.microsoftonline.com/${msalConfig.auth.authority.split('/').pop()}/oauth2/v2.0/authorize?` +
      `client_id=${msalConfig.auth.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(msalConfig.auth.redirectUri)}&` +
      `response_mode=query&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `state=${Math.random().toString(36).substring(7)}`;

    window.location.href = loginUrl;
    resolve();
  });
};

/**
 * Get Office 365 access token
 */
export const getOffice365Token = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  // Check session storage
  const token = sessionStorage.getItem('msal_access_token');
  if (token) {
    // Check if token is still valid (not expired)
    const tokenExpiry = sessionStorage.getItem('msal_access_token_expiry');
    if (tokenExpiry && new Date().getTime() < parseInt(tokenExpiry)) {
      return token;
    }
  }

  // Try to get token from API
  try {
    const response = await fetch('/api/office365/token');
    if (response.ok) {
      const data = await response.json();
      if (data.accessToken) {
        sessionStorage.setItem('msal_access_token', data.accessToken);
        sessionStorage.setItem('msal_access_token_expiry', (new Date().getTime() + (data.expiresIn * 1000)).toString());
        return data.accessToken;
      }
    }
  } catch (error) {
    console.error('Error getting Office 365 token:', error);
  }

  return null;
};

/**
 * Sync calendar event to Office 365
 */
export const syncCalendarEventToOffice365 = async (event: CalendarEvent): Promise<boolean> => {
  try {
    const token = await getOffice365Token();
    if (!token) {
      throw new Error('Office 365 not authenticated. Please sign in first.');
    }

    const response = await fetch('/api/office365/calendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync calendar event');
    }

    return true;
  } catch (error) {
    console.error('Error syncing calendar event:', error);
    throw error;
  }
};

/**
 * Send email via Office 365
 */
export const sendEmailViaOffice365 = async (message: EmailMessage): Promise<boolean> => {
  try {
    const token = await getOffice365Token();
    if (!token) {
      throw new Error('Office 365 not authenticated. Please sign in first.');
    }

    const response = await fetch('/api/office365/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send email');
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Get Office 365 calendar events
 */
export const getOffice365CalendarEvents = async (startDate: string, endDate: string): Promise<any[]> => {
  try {
    const token = await getOffice365Token();
    if (!token) {
      throw new Error('Office 365 not authenticated. Please sign in first.');
    }

    const response = await fetch(`/api/office365/calendar?startDateTime=${startDate}&endDateTime=${endDate}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
};

/**
 * Check if user is authenticated with Office 365
 */
export const isOffice365Authenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = sessionStorage.getItem('msal_access_token');
  if (!token) return false;
  
  const tokenExpiry = sessionStorage.getItem('msal_access_token_expiry');
  if (!tokenExpiry) return false;
  
  return new Date().getTime() < parseInt(tokenExpiry);
};

/**
 * Disconnect Office 365 account
 */
export const disconnectOffice365 = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('msal_access_token');
  sessionStorage.removeItem('msal_access_token_expiry');
  sessionStorage.removeItem('msal_id_token');
};

/**
 * Send calendar invite to multiple attendees via Office 365
 */
export const sendCalendarInvite = async (
  event: CalendarEvent,
  attendees: string[] // Array of email addresses
): Promise<boolean> => {
  try {
    const token = await getOffice365Token();
    if (!token) {
      throw new Error('Office 365 not authenticated. Please sign in first.');
    }

    // Add attendees to the event
    const eventWithAttendees: CalendarEvent = {
      ...event,
      attendees: attendees.map(email => ({
        emailAddress: { 
          address: email,
          name: email.split('@')[0] || email, // Use email prefix as name, fallback to email
        },
        type: 'required',
      })),
    };

    const response = await fetch('/api/office365/calendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventWithAttendees),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error?.message || error?.error || 'Failed to send calendar invite';
      throw new Error(message);
    }

    return true;
  } catch (error) {
    console.error('Error sending calendar invite:', error);
    throw error;
  }
};