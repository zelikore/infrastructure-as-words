import {
  browserSessionSchema,
  type BrowserSession
} from "@infrastructure-as-words/contracts";
import { getRuntimeConfig } from "./runtime";

const SESSION_STORAGE_KEY = "infrastructure-as-words.session.v1";
const PKCE_STORAGE_KEY = "infrastructure-as-words.pkce.v1";
const SESSION_CHANGE_EVENT = "infrastructure-as-words-session-change";

type PendingPkceState = {
  state: string;
  verifier: string;
};

export type SessionProfile = BrowserSession["profile"];

const readJson = <T>(storageKey: string): T | undefined => {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return undefined;
  }

  return JSON.parse(raw) as T;
};

const writeJson = (storageKey: string, value: unknown) => {
  window.localStorage.setItem(storageKey, JSON.stringify(value));
};

const dispatchSessionChange = () => {
  window.dispatchEvent(new CustomEvent(SESSION_CHANGE_EVENT));
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
};

const parseJwtPayload = (token: string): Record<string, unknown> => {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) {
    throw new Error("JWT payload is missing.");
  }

  return JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>;
};

const resolveProfile = (idToken: string): SessionProfile => {
  const payload = parseJwtPayload(idToken);
  const sub = typeof payload["sub"] === "string" ? payload["sub"] : undefined;
  if (!sub) {
    throw new Error("The ID token does not contain a subject claim.");
  }

  return {
    sub,
    ...(typeof payload["email"] === "string" ? { email: payload["email"] } : {}),
    ...(typeof payload["name"] === "string" ? { name: payload["name"] } : {})
  };
};

const isExpiringSoon = (session: BrowserSession): boolean =>
  Date.parse(session.expiresAt) <= Date.now() + 60_000;

const createRandomString = (byteLength: number): string => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

const toSha256Base64Url = async (value: string): Promise<string> => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const readStoredSession = (): BrowserSession | undefined => {
  const parsed = readJson<unknown>(SESSION_STORAGE_KEY);
  return parsed ? browserSessionSchema.parse(parsed) : undefined;
};

const writeSession = (session: BrowserSession) => {
  writeJson(SESSION_STORAGE_KEY, session);
  dispatchSessionChange();
};

export const clearSession = () => {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.localStorage.removeItem(PKCE_STORAGE_KEY);
  dispatchSessionChange();
};

const exchangeToken = async (
  body: URLSearchParams
): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
}> => {
  const runtimeConfig = await getRuntimeConfig();
  const response = await fetch(`https://${runtimeConfig.authDomain}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("The Cognito token exchange failed.");
  }

  return (await response.json()) as {
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in: number;
  };
};

const persistTokens = (input: {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}): BrowserSession => {
  const session: BrowserSession = {
    accessToken: input.accessToken,
    idToken: input.idToken,
    refreshToken: input.refreshToken,
    expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
    profile: resolveProfile(input.idToken)
  };

  writeSession(browserSessionSchema.parse(session));
  return session;
};

export const startLogin = async (): Promise<void> => {
  const runtimeConfig = await getRuntimeConfig();
  const state = createRandomString(16);
  const verifier = createRandomString(48);
  const challenge = await toSha256Base64Url(verifier);

  writeJson(PKCE_STORAGE_KEY, {
    state,
    verifier
  } satisfies PendingPkceState);

  const authorizeUrl = new URL(`https://${runtimeConfig.authDomain}/oauth2/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", runtimeConfig.userPoolClientId);
  authorizeUrl.searchParams.set("redirect_uri", runtimeConfig.redirectUri);
  authorizeUrl.searchParams.set("scope", runtimeConfig.oauthScopes.join(" "));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("state", state);

  window.location.assign(authorizeUrl.toString());
};

export const completeLogin = async (input: {
  code: string;
  state: string;
}): Promise<BrowserSession> => {
  const runtimeConfig = await getRuntimeConfig();
  const pendingState = readJson<PendingPkceState>(PKCE_STORAGE_KEY);

  if (!pendingState) {
    throw new Error("The PKCE verifier is missing from browser storage.");
  }

  if (pendingState.state !== input.state) {
    throw new Error("The PKCE state returned from Cognito did not match the original request.");
  }

  const tokenResponse = await exchangeToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: runtimeConfig.userPoolClientId,
      code: input.code,
      redirect_uri: runtimeConfig.redirectUri,
      code_verifier: pendingState.verifier
    })
  );

  window.localStorage.removeItem(PKCE_STORAGE_KEY);

  if (!tokenResponse.refresh_token) {
    throw new Error("Cognito did not return a refresh token for the browser session.");
  }

  return persistTokens({
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token,
    refreshToken: tokenResponse.refresh_token,
    expiresInSeconds: tokenResponse.expires_in
  });
};

const refreshSession = async (session: BrowserSession): Promise<BrowserSession> => {
  if (!session.refreshToken) {
    throw new Error("The browser session does not contain a refresh token.");
  }

  const runtimeConfig = await getRuntimeConfig();
  const tokenResponse = await exchangeToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: runtimeConfig.userPoolClientId,
      refresh_token: session.refreshToken
    })
  );

  return persistTokens({
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token,
    refreshToken: session.refreshToken,
    expiresInSeconds: tokenResponse.expires_in
  });
};

export const getSession = async (): Promise<BrowserSession | undefined> => {
  const stored = readStoredSession();
  if (!stored) {
    return undefined;
  }

  if (!isExpiringSoon(stored)) {
    return stored;
  }

  try {
    return await refreshSession(stored);
  } catch {
    clearSession();
    return undefined;
  }
};

export const subscribeToSessionChanges = (listener: () => void): (() => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === SESSION_STORAGE_KEY) {
      listener();
    }
  };

  const handleCustom = () => {
    listener();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SESSION_CHANGE_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SESSION_CHANGE_EVENT, handleCustom);
  };
};

export const logout = async (): Promise<void> => {
  const runtimeConfig = await getRuntimeConfig();
  clearSession();

  const logoutUrl = new URL(`https://${runtimeConfig.authDomain}/logout`);
  logoutUrl.searchParams.set("client_id", runtimeConfig.userPoolClientId);
  logoutUrl.searchParams.set("logout_uri", runtimeConfig.logoutUri);

  window.location.assign(logoutUrl.toString());
};
