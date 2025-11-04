# Office 365 Integration Setup Guide

This guide explains how to set up Office 365 integration for Planner calendar sync and email functionality.

## Prerequisites

1. **Microsoft Azure App Registration**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to **Azure Active Directory** > **App registrations**
   - Click **New registration**

2. **Register Your Application**
   - **Name**: Your ATS Application Name
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: 
     - Type: **Web**
     - URL: `https://yourdomain.com/api/office365/callback` (or `http://localhost:3000/api/office365/callback` for development)

3. **Configure API Permissions**
   - Go to **API permissions** in your app registration
   - Click **Add a permission** > **Microsoft Graph** > **Delegated permissions**
   - Add the following permissions:
     - `Calendars.ReadWrite` - Read and write user calendars
     - `Mail.Send` - Send mail as the user
     - `User.Read` - Read user profile
   - Click **Add permissions**
   - Click **Grant admin consent** (if you're an admin)

4. **Get Your Credentials**
   - Go to **Certificates & secrets**
   - Create a **New client secret**
   - Copy the **Value** (you'll need this)
   - Go to **Overview** and copy:
     - **Application (client) ID**
     - **Directory (tenant) ID**

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Office 365 / Microsoft Graph API Configuration
NEXT_PUBLIC_MS_CLIENT_ID=your-application-client-id
NEXT_PUBLIC_MS_TENANT_ID=your-tenant-id (or 'common' for multi-tenant)
MS_CLIENT_SECRET=your-client-secret-value
```

## Features

### 1. Planner Calendar Sync
- **Connect Office 365**: Click "Connect Office 365" button in the Planner page
- **Sync to Calendar**: Sync appointments from the planner to your Office 365 calendar
- **Fetch from Calendar**: Pull events from your Office 365 calendar into the planner
- **Auto-sync**: Calendar events are synced in real-time

### 2. Email Integration
- **Send Emails**: When Office 365 is connected, emails sent through the application will use Office 365 instead of mailto
- **Onboarding Emails**: Onboarding documents are sent via Office 365
- **Reference Emails**: Reference forms are sent via Office 365
- **Fallback**: If Office 365 is not connected, falls back to mailto links

## How It Works

1. **Authentication Flow**:
   - User clicks "Connect Office 365"
   - Redirects to Microsoft login page
   - User authenticates with their Microsoft account
   - Returns to application with access token
   - Token is stored in session storage

2. **Calendar Sync**:
   - When syncing appointments, each appointment is converted to a Microsoft Graph calendar event
   - Events are created in the user's Office 365 calendar
   - Events include all appointment details (type, client, job, references, owner)

3. **Email Sending**:
   - Emails are sent via Microsoft Graph API
   - Emails appear in the user's Office 365 Sent Items
   - Supports HTML and plain text emails
   - Supports attachments (for onboarding/reference documents)

## Security Notes

- Access tokens are stored in session storage (client-side only)
- Tokens expire after 1 hour (default) and can be refreshed
- Client secret should NEVER be exposed in client-side code
- All API calls are made server-side to protect secrets

## Troubleshooting

1. **"Unauthorized" errors**: 
   - Check that admin consent has been granted for all permissions
   - Verify client ID and tenant ID are correct
   - Ensure redirect URI matches exactly in Azure portal

2. **"Redirect URI mismatch"**:
   - Make sure the redirect URI in Azure matches your application URL exactly
   - Include the full path: `/api/office365/callback`

3. **Token expires quickly**:
   - Tokens expire after 1 hour by default
   - Implement token refresh logic if needed
   - User can reconnect if token expires

## API Endpoints

- `GET /api/office365/token` - Get current access token
- `POST /api/office365/calendar` - Create calendar event
- `GET /api/office365/calendar` - Fetch calendar events
- `POST /api/office365/email` - Send email
- `GET /api/office365/callback` - OAuth callback handler

## Testing

1. Start your development server
2. Navigate to `/dashboard/planner`
3. Click "Connect Office 365"
4. Complete Microsoft authentication
5. Test syncing appointments to calendar
6. Test sending emails via Office 365

## Production Deployment

1. Update redirect URI in Azure to production URL
2. Set environment variables in your hosting platform (Vercel, etc.)
3. Ensure HTTPS is enabled (required for OAuth)
4. Test the complete flow in production environment

