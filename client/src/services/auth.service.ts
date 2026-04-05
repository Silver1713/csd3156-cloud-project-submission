/**
 * Client-side auth/session helper for Cognito login, token persistence,
 * backend account resolution, and cached organization context.
 */
export type BackendAuthAccount = {
  id: string;
  orgId: string;
  profileUrl: string | null;
  name: string | null;
  username: string;
  email: string;
  authProvider: "backend" | "cognito";
  cognitoSub: string | null;
  roleId: string | null;
};

type CognitoStatusResponse = {
  provider: "cognito";
  configured: boolean;
  message: string;
};

type LoginPayload = {
  username: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  username: string;
  password: string;
  joinKey?: string;
};

type CognitoTokens = {
  accessToken: string;
  idToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string | null;
};

type CognitoProfile = {
  email: string;
  username: string;
  sub: string;
};

export type StoredOrganizationSummary = {
  id: string;
  name: string | null;
  joinKey: string | null;
  criticalStockThreshold: number;
  lowStockThreshold: number;
  capabilities: {
    canDeleteOrganization: boolean;
    canRegenerateJoinKey: boolean;
    canViewJoinKey: boolean;
  };
};

type StoredCognitoSession = {
  tokens: CognitoTokens;
  profile: CognitoProfile;
  account: BackendAuthAccount | null;
  organization: StoredOrganizationSummary | null;
};

type CognitoRegisterResult = {
  userSub: string;
  userConfirmed: boolean;
  codeDeliveryDestination: string | null;
  email: string;
  username: string;
};

type CognitoResolveClaims = {
  sub: string;
  tokenUse: string;
  username?: string;
  email?: string;
};

export type CognitoResolveResponse = {
  provider: "cognito";
  verified: true;
  provisioned: boolean;
  account: BackendAuthAccount;
  claims: CognitoResolveClaims;
};

type AccountsResponse = {
  accounts: BackendAuthAccount[];
};

type CognitoAuthenticationResult = {
  AccessToken?: string;
  IdToken?: string;
  RefreshToken?: string;
  ExpiresIn?: number;
  TokenType?: string;
};

type InitiateAuthResponse = {
  AuthenticationResult?: CognitoAuthenticationResult;
  ChallengeName?: string;
};

type CognitoRefreshResponse = {
  provider: "cognito";
  accessToken: string;
  idToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string | null;
};

type SignUpResponse = {
  UserSub?: string;
  UserConfirmed?: boolean;
  CodeDeliveryDetails?: {
    Destination?: string;
  };
};

type ChangePasswordResponse = Record<string, never>;

type JwtPayload = {
  email?: string;
  sub?: string;
  username?: string;
  "cognito:username"?: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";
const API_PREFIX = "/api";
const COGNITO_USER_POOL_ID =
  import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim() || "";
const COGNITO_CLIENT_ID =
  import.meta.env.VITE_COGNITO_CLIENT_ID?.trim() || "";
const SESSION_STORAGE_KEY = "cognito-session";
const PENDING_JOIN_KEY_STORAGE_KEY = "pending-org-join-key";

function normalizeJoinKey(joinKey: string | null | undefined): string | null {
  const normalized = joinKey?.trim().toUpperCase() ?? "";
  return normalized.length > 0 ? normalized.replace(/[^A-Z0-9]/g, "").slice(0, 8) : null;
}

function getCognitoRegion(): string {
  const [region] = COGNITO_USER_POOL_ID.split("_");

  if (!region) {
    throw new Error("Missing Cognito user pool configuration");
  }

  return region;
}

function getCognitoEndpoint(): string {
  return `https://cognito-idp.${getCognitoRegion()}.amazonaws.com/`;
}

function assertCognitoClientConfig(): void {
  if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
    throw new Error("Client Cognito configuration is incomplete");
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | { message?: string };

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "Request failed";

    throw new Error(message);
  }

  return payload as T;
}

async function callCognito<TResponse>(
  target: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  assertCognitoClientConfig();

  const response = await fetch(getCognitoEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": target,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as {
    __type?: string;
    message?: string;
  } & TResponse;

  if (!response.ok) {
    const message = payload.message || payload.__type || "Cognito request failed";
    throw new Error(message);
  }

  return payload as TResponse;
}

function decodeJwtPayload(token: string): JwtPayload {
  const segments = token.split(".");

  if (segments.length < 2) {
    throw new Error("Invalid JWT received from Cognito");
  }

  const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  const json = atob(padded);

  return JSON.parse(json) as JwtPayload;
}

function buildSession(
  tokens: CognitoTokens,
  previousSession: StoredCognitoSession | null = null,
): StoredCognitoSession {
  const payload = decodeJwtPayload(tokens.idToken);

  return {
    tokens,
    profile: {
      email: payload.email ?? "",
      username: payload["cognito:username"] ?? payload.username ?? "",
      sub: payload.sub ?? "",
    },
    account: previousSession?.account ?? null,
    organization: previousSession?.organization ?? null,
  };
}

/**
 * Persists the full Cognito session bundle in local storage.
 */
export function persistCognitoSession(session: StoredCognitoSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Reads the cached Cognito session from local storage when available.
 */
export function getStoredCognitoSession(): StoredCognitoSession | null {
  const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredCognitoSession;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

/**
 * Clears tokens, cached account data, and any pending join-key state.
 */
export function clearStoredCognitoSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(PENDING_JOIN_KEY_STORAGE_KEY);
}

export function getStoredResolvedAccount(): BackendAuthAccount | null {
  return getStoredCognitoSession()?.account ?? null;
}

export function getStoredOrganizationSummary(): StoredOrganizationSummary | null {
  return getStoredCognitoSession()?.organization ?? null;
}

/**
 * Caches the resolved backend account for shell bootstrap.
 */
export function cacheResolvedAccount(account: BackendAuthAccount): void {
  const session = getStoredCognitoSession();

  if (!session) {
    return;
  }

  const organization =
    session.organization?.id === account.orgId ? session.organization : null;

  persistCognitoSession({
    ...session,
    account,
    organization,
  });
}

/**
 * Caches the current organization summary alongside the resolved account.
 */
export function cacheOrganizationSummary(
  organization: StoredOrganizationSummary | null,
): void {
  const session = getStoredCognitoSession();

  if (!session) {
    return;
  }

  persistCognitoSession({
    ...session,
    organization,
  });
}

/**
 * Signs the browser out by clearing all locally persisted auth state.
 */
export function signOutOfCognito(): void {
  clearStoredCognitoSession();
}

function cachePendingJoinKey(joinKey: string | null): void {
  if (joinKey) {
    localStorage.setItem(PENDING_JOIN_KEY_STORAGE_KEY, joinKey);
    return;
  }

  localStorage.removeItem(PENDING_JOIN_KEY_STORAGE_KEY);
}

function getPendingJoinKey(): string | null {
  return normalizeJoinKey(localStorage.getItem(PENDING_JOIN_KEY_STORAGE_KEY));
}

/**
 * Indicates whether the frontend has enough configuration to use Cognito.
 */
export function isCognitoConfigured(): boolean {
  return Boolean(COGNITO_USER_POOL_ID && COGNITO_CLIENT_ID);
}

/**
 * Returns the cached access token used for authenticated backend requests.
 */
export function getStoredAccessToken(): string | null {
  return getStoredCognitoSession()?.tokens.accessToken ?? null;
}

export function getStoredIdToken(): string | null {
  return getStoredCognitoSession()?.tokens.idToken ?? null;
}

export function getStoredRefreshToken(): string | null {
  return getStoredCognitoSession()?.tokens.refreshToken ?? null;
}

/**
 * Restores a lightweight profile from stored tokens before the app resolves the
 * backend account.
 */
export async function restoreStoredAuthSession(): Promise<CognitoProfile | null> {
  const session = getStoredCognitoSession();

  if (!session) {
    return null;
  }

  return session.profile;
}

/**
 * Fetches backend Cognito availability metadata for the auth page.
 */
export async function getCognitoStatus(): Promise<CognitoStatusResponse> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/cognito`);
  return parseJsonResponse<CognitoStatusResponse>(response);
}

/**
 * Authenticates directly against Cognito and persists the returned token set.
 */
export async function loginWithCognito(
  payload: LoginPayload,
): Promise<StoredCognitoSession> {
  const response = await callCognito<InitiateAuthResponse>(
    "AWSCognitoIdentityProviderService.InitiateAuth",
    {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: payload.username,
        PASSWORD: payload.password,
      },
    },
  );

  if (response.ChallengeName) {
    throw new Error(`Unsupported Cognito challenge: ${response.ChallengeName}`);
  }

  const authenticationResult = response.AuthenticationResult;

  if (!authenticationResult?.AccessToken || !authenticationResult.IdToken) {
    throw new Error("Cognito did not return the expected tokens");
  }

  const session = buildSession({
    accessToken: authenticationResult.AccessToken,
    idToken: authenticationResult.IdToken,
    refreshToken: authenticationResult.RefreshToken ?? null,
    expiresIn: authenticationResult.ExpiresIn ?? null,
    tokenType: authenticationResult.TokenType ?? null,
  });

  persistCognitoSession(session);
  return session;
}

/**
 * Registers a new Cognito user and stores any pending join key for the first
 * resolve step.
 */
export async function registerWithCognito(
  payload: RegisterPayload,
): Promise<CognitoRegisterResult> {
  cachePendingJoinKey(normalizeJoinKey(payload.joinKey));
  const response = await callCognito<SignUpResponse>(
    "AWSCognitoIdentityProviderService.SignUp",
    {
      ClientId: COGNITO_CLIENT_ID,
      Username: payload.username,
      Password: payload.password,
      UserAttributes: [
        {
          Name: "email",
          Value: payload.email.trim().toLowerCase(),
        },
        {
          Name: "preferred_username",
          Value: payload.username.trim(),
        },
      ],
    },
  );

  if (!response.UserSub) {
    throw new Error("Cognito did not return a user identifier");
  }

  return {
    userSub: response.UserSub,
    userConfirmed: Boolean(response.UserConfirmed),
    codeDeliveryDestination: response.CodeDeliveryDetails?.Destination ?? null,
    email: payload.email.trim().toLowerCase(),
    username: payload.username.trim(),
  };
}

/**
 * Changes the password for the currently authenticated Cognito user.
 */
export async function changePasswordWithCognito(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const accessToken = getStoredAccessToken();

  if (!accessToken) {
    throw new Error("No active Cognito session is available");
  }

  await callCognito<ChangePasswordResponse>(
    "AWSCognitoIdentityProviderService.ChangePassword",
    {
      AccessToken: accessToken,
      PreviousPassword: payload.currentPassword,
      ProposedPassword: payload.newPassword,
    },
  );
}

export async function listAccountsWithBearer(
  accessToken: string,
): Promise<BackendAuthAccount[]> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/accounts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await parseJsonResponse<AccountsResponse>(response);
  return payload.accounts;
}

/**
 * Exchanges the stored Cognito tokens for the provisioned backend account and
 * organization context.
 */
export async function resolveStoredCognitoSession(): Promise<CognitoResolveResponse> {
  const session = getStoredCognitoSession();

  if (!session) {
    throw new Error("No stored Cognito session is available");
  }

  return resolveCognitoSession(
    session.tokens.accessToken,
    session.tokens.idToken,
    getPendingJoinKey(),
  );
}

/**
 * Uses the refresh token to renew an expired Cognito session in place.
 */
export async function refreshStoredCognitoSession(): Promise<StoredCognitoSession> {
  const currentSession = getStoredCognitoSession();
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    throw new Error("No stored Cognito refresh token is available");
  }

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/cognito/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  const payload = await parseJsonResponse<CognitoRefreshResponse>(response);

  const session = buildSession(
    {
      accessToken: payload.accessToken,
      idToken: payload.idToken,
      refreshToken: payload.refreshToken ?? refreshToken,
      expiresIn: payload.expiresIn,
      tokenType: payload.tokenType,
    },
    currentSession,
  );

  persistCognitoSession(session);
  return session;
}

/**
 * Resolves a newly acquired Cognito session into the backend account/session
 * shape consumed by the application shell.
 */
export async function resolveCognitoSession(
  accessToken: string,
  idToken: string,
  joinKey?: string | null,
): Promise<CognitoResolveResponse> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/cognito/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken,
      idToken,
      joinKey: normalizeJoinKey(joinKey) ?? undefined,
    }),
  });

  const payload = await parseJsonResponse<CognitoResolveResponse>(response);
  cachePendingJoinKey(null);
  cacheResolvedAccount(payload.account);
  return payload;
}
