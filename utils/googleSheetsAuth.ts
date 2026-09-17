const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => TokenClient;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleAccountsOAuth2;
      };
    };
  }
}

let gisLoadPromise: Promise<void> | null = null;
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export const getGoogleClientId = (): string => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId || !String(clientId).trim()) {
    throw new Error(
      'Missing VITE_GOOGLE_CLIENT_ID. Create an OAuth Web client in Google Cloud and set it in .env.local.',
    );
  }
  return String(clientId).trim();
};

export const loadGoogleIdentityServices = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requires a browser.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')));
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Failed to load Google Identity Services script.'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
};

const isTokenFresh = (): boolean => {
  if (!cachedToken) return false;
  // Refresh 60s before expiry
  return Date.now() < cachedToken.expiresAt - 60_000;
};

export const getCachedGoogleAccessToken = (): string | null => {
  return isTokenFresh() ? cachedToken!.accessToken : null;
};

export const clearGoogleAccessToken = (): void => {
  cachedToken = null;
};

/**
 * Request (or reuse) a Google OAuth access token with Sheets scope via GIS token client.
 * Shows the Google account picker / consent UI when needed.
 */
export const requestGoogleSheetsAccessToken = async (options?: {
  promptConsent?: boolean;
}): Promise<string> => {
  if (isTokenFresh() && !options?.promptConsent) {
    return cachedToken!.accessToken;
  }

  const clientId = getGoogleClientId();
  await loadGoogleIdentityServices();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services failed to initialize.');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SHEETS_SCOPE,
      callback: (response: GoogleTokenResponse) => {
        if (response.error) {
          finish(() =>
            reject(
              new Error(response.error_description || response.error || 'Google authorization failed.'),
            ),
          );
          return;
        }
        if (!response.access_token) {
          finish(() => reject(new Error('Google authorization returned no access token.')));
          return;
        }
        const expiresInMs = Number(response.expires_in || 3600) * 1000;
        cachedToken = {
          accessToken: response.access_token,
          expiresAt: Date.now() + expiresInMs,
        };
        finish(() => resolve(response.access_token));
      },
      error_callback: error => {
        finish(() =>
          reject(new Error(error?.message || error?.type || 'Google authorization was cancelled.')),
        );
      },
    });

    client.requestAccessToken({
      prompt: options?.promptConsent ? 'consent' : '',
    });
  });
};

export const SHEETS_OAUTH_SCOPE = SHEETS_SCOPE;
