export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate Google OAuth authorization URL
 * This initiates the OAuth 2.0 authorization code flow with Google
 */
export const getGoogleOAuthUrl = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const scope = "openid email profile";
  const responseType = "code";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    scope,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const getLoginUrl = () => {
  return getGoogleOAuthUrl();
};
