---
name: "oauth-integration"
description: >
  Guidelines for implementing OAuth flows (Strava, GitHub, etc.) in the
  AI Studio preview environment. Use when the user requests OAuth, login with
  third-party services, or popup-based authentication. Covers iframe constraints,
  cookie configuration, and redirect URI setup.
---

# OAuth Integration Guidelines

When implementing OAuth flows (e.g., Strava, Google, GitHub, Spotify) in the AI
Studio preview environment, follow these guidelines carefully. The preview runs
in an **iframe** with cross-origin restrictions requiring specific handling.

**CRITICAL**: These instructions do not apply for OAuth implemented via Firebase
Auth. Firebase sets up the OAuth flow automatically and handles the iframe
constraints.

**CRITICAL**: These instructions do not apply for Google Workspace integrations.
If you are integrating Google Workspace APIs (e.g., Google Drive, Docs, Sheets,
Calendar, Gmail, etc.), do NOT use this general OAuth skill. Instead, refer to
the more specific `workspace-integration` skill which utilizes Firebase Auth for
Google Workspace authentication.

## Critical: AI Studio Preview Environment Constraints

> [!CAUTION]
>
> The AI Studio preview runs inside an **iframe** and will NOT work if opened
> directly in a popup window. OAuth popups **must** open the OAuth provider's
> authorization URL directly—never the container's own routes.

Key constraints:

-   **Container is iframe-only**: The preview container only works when embedded
    in an iframe. Opening container URLs directly in a popup shows a static
    fallback page indefinitely.
-   **Dynamic URL**: The preview URL is dynamically generated (not `localhost`)
-   **Cross-origin iframe**: Third-party cookies are restricted by default
-   **Popup communication**: OAuth popups must use `postMessage` cross-origin

### URLs provided at runtime

> [!IMPORTANT]
>
> Two URLs are provided in your runtime context (as a separate message at the
> start of this conversation):
>
> -   **App URL** - Your development container URL
> -   **Shared App URL** - Your shared (deployed) container URL
>
> When writing code, **always** use the `APP_URL` environment variable to get
> the URL of the container. Do **not** attempt to dynamically construct the URL
> from request headers as this is unreliable behind proxies like nginx.

## 1. Use Popup-Based OAuth Flow (Provider URL Directly)

**Do NOT use redirect-based OAuth** (`signInWithRedirect` patterns). Use a popup
that opens the **OAuth provider's URL directly**:

> [!IMPORTANT]
>
> The popup must open the OAuth provider's authorization URL (e.g.,
> `https://www.strava.com/oauth/authorize?...`), NOT a container route like
> `/auth/login`. The container cannot render properly outside of its iframe.

### Server-Side: Construct OAuth URL Endpoint

Create an API endpoint that **returns** the OAuth authorization URL. The client
will fetch this URL and open it directly in the popup:

```ts
// server/routes/auth.ts
app.get('/api/auth/url', (req, res) => {
  const redirectUri = getRedirectUri(req);

  // Construct the OAuth provider's authorization URL
  // Replace with your provider's authorize endpoint and scopes
  const params = new URLSearchParams({
    client_id: process.env.OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'your_scopes_here', // e.g., 'read,activity:read' for Strava
  });

  // Replace with your OAuth provider's authorization endpoint
  const providerAuthUrl = process.env.OAUTH_PROVIDER_URL
    || 'https://provider.example.com/oauth/authorize';
  const authUrl = `${providerAuthUrl}?${params}`;

  res.json({ url: authUrl });
});
```

### Client-Side: Fetch URL and Open Popup

```tsx
const handleConnect = async () => {
  try {
    // 1. Fetch the OAuth URL from your server
    const response = await fetch('/api/auth/url');
    if (!response.ok) {
      throw new Error('Failed to get auth URL');
    }
    const { url } = await response.json();

    // 2. Open the OAuth PROVIDER's URL directly in popup
    //    (NOT a container route like /auth/login)
    const authWindow = window.open(
      url,  // e.g., 'https://provider.example.com/oauth/authorize?...'
      'oauth_popup',
      'width=600,height=700'
    );

    if (!authWindow) {
      // Popup was blocked
      alert('Please allow popups for this site to connect your account.');
    }
  } catch (error) {
    console.error('OAuth error:', error);
    // Handle error (show toast, etc.)
  }
};

// Listen for success message from popup (after callback completes)
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // Validate origin is from AI Studio preview or localhost
    const origin = event.origin;
    if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
      return;
    }
    if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
      fetchUserData();
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### Callback Handler with postMessage

The OAuth provider redirects back to your callback URL. This route returns a
simple HTML page (not your full app) that sends a success message to the opener
window and closes itself. Since it's just an HTML snippet—not the full
application—it works fine in the popup despite the iframe-only constraint:

```ts
// In your callback route handler
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  const tokens = await exchangeCodeForTokens(code);
  // Store tokens as appropriate for your architecture

  // Send success message to parent window and close popup
  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Authentication successful. This window should close automatically.</p>
      </body>
    </html>
  `);
});
```

## 2. Cookie Configuration for Iframe Context

If using cookies for session management, standard settings will NOT work in the
AI Studio preview iframe. Configure cookies with these attributes:

```ts
cookie: {
  secure: true,      // Required for SameSite=None
  sameSite: 'none',  // Required for cross-origin iframe
  httpOnly: true,    // Security best practice
}
```

> [!IMPORTANT]
>
> `SameSite: 'none'` and `Secure: true` are **required** together. Without
> these, cookies will be silently blocked by the browser in the iframe context.

## 3. Redirect URI Construction

The OAuth provider's callback URL must match exactly. Since the AI Studio
preview URL is dynamic, you need to construct it correctly based on context.

### Client-Side: Use `window.location.origin`

For OAuth flows initiated from the browser (e.g., building the auth URL on the
client before opening a popup), use `window.location.origin`:

```ts
// Client-side code (React, Vue, vanilla JS, etc.)
const redirectUri = `${window.location.origin}/auth/callback`;

// This works across all environments automatically:
// - Local dev: http://localhost:3000/auth/callback
// - Production: https://your-app-abc123.run.app/auth/callback
```

### Handle Trailing Slash Variations

Some OAuth providers or proxies may add/remove trailing slashes. Handle both:

```ts
app.get(['/auth/callback', '/auth/callback/'], callbackHandler);
```

## 4. OAuth Provider Configuration

After implementing OAuth, give the user clear setup instructions:

> [!CAUTION]
>
> **MANDATORY**: When implementing OAuth, you MUST always include the actual
> callback URL (e.g. `https://your-url.run.app/your-callback-path`) in your text
> response to the user. Never use placeholders like "YOUR_APP_URL" or
> "localhost". The user needs the exact URL to configure their OAuth provider.
> These are provided to you in the "URLs provided at runtime" section above.

--------------------------------------------------------------------------------

**📋 OAuth Setup - Required Steps:**

1.  **Open your OAuth provider's dashboard**

    -   Strava: https://www.strava.com/settings/api
    -   Google: https://console.cloud.google.com/apis/credentials
    -   GitHub: https://github.com/settings/developers

2.  **Add these callback URLs to your app settings:**

    -   **Development URL:** `<App URL from runtime context>/auth/callback`
    -   **Shared/Deployed URL:** `<Shared App URL from runtime
        context>/auth/callback` > The **Shared URL** is the container URL users
        will interact with when your application is shared. Add both URLs to
        your OAuth provider if needed. The path must match the route implemented
        in your code.

3.  **Set these environment variables in AI Studio:**

    -   `CLIENT_ID` - Your OAuth app's Client ID
    -   `CLIENT_SECRET` - Your OAuth app's Client Secret

> [!IMPORTANT]
>
> Do not include the Gemini API key in the environment variable setup
> instruction, as it is handled by the platform.

1.  **Click "Connect" in the app to test**

--------------------------------------------------------------------------------

> [!IMPORTANT]
>
> The callback URL path (e.g., `/auth/callback`) must match what you
> implemented. Always use the actual app URL shown above—never `localhost`.

## Common Errors and Solutions

| Error                   | Cause                   | Solution                 |
| ----------------------- | ----------------------- | ------------------------ |
| Popup shows spinner     | Opened container URL    | Open OAuth provider URL  |
| forever                 | instead of provider URL | directly in popup        |
| `redirect_uri: invalid` | Mismatch between code   | Display exact URI in UI, |
|                         | and provider config     | copy to provider         |
|                         |                         | settings                 |
| `Cannot GET             | Route not registered or | Register both            |
| /auth/callback`         | trailing slash issue    | `/callback` and          |
|                         |                         | `/callback/`             |
| Cookies not persisted   | Missing SameSite/Secure | Set `SameSite: 'none'`,  |
|                         | config                  | `Secure: true`           |
| Popup blocked           | Browser popup blocker   | Ensure popup is          |
|                         |                         | triggered by user action |
|                         |                         | (click)                  |
| `window.opener` is null | Cross-origin            | Use `postMessage` with   |
|                         | restrictions            | `'*'` origin             |
