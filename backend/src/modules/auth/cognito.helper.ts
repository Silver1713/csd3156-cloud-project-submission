import { CognitoJwtVerifier } from "aws-jwt-verify";

type CognitoTokenUse = "access" | "id";

export type CognitoJwtPayload = {
  sub: string;
  email?: string;
  token_use: CognitoTokenUse;
  username?: string;
  "cognito:username"?: string;
};

type CognitoConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
};

let accessTokenVerifier:
  | ReturnType<typeof CognitoJwtVerifier.create>
  | undefined;
let idTokenVerifier:
  | ReturnType<typeof CognitoJwtVerifier.create>
  | undefined;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required Cognito environment variable: ${name}`);
  }

  return value;
}

export function isCognitoConfigured(): boolean {
  return Boolean(
    process.env.AWS_REGION?.trim() &&
      process.env.COGNITO_USER_POOL_ID?.trim() &&
      process.env.COGNITO_CLIENT_ID?.trim(),
  );
}

export function getCognitoConfig(): CognitoConfig {
  return {
    region: getRequiredEnv("AWS_REGION"),
    userPoolId: getRequiredEnv("COGNITO_USER_POOL_ID"),
    clientId: getRequiredEnv("COGNITO_CLIENT_ID"),
  };
}

function getAccessTokenVerifier() {
  if (!accessTokenVerifier) {
    const { userPoolId, clientId } = getCognitoConfig();

    accessTokenVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "access",
      clientId,
    });
  }

  return accessTokenVerifier;
}

function getIdTokenVerifier() {
  if (!idTokenVerifier) {
    const { userPoolId, clientId } = getCognitoConfig();

    idTokenVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "id",
      clientId,
    });
  }

  return idTokenVerifier;
}

export async function verifyCognitoAccessToken(
  token: string,
): Promise<CognitoJwtPayload> {
  const payload = await getAccessTokenVerifier().verify(token);
  return payload as CognitoJwtPayload;
}

export async function verifyCognitoIdToken(
  token: string,
): Promise<CognitoJwtPayload> {
  const payload = await getIdTokenVerifier().verify(token);
  return payload as CognitoJwtPayload;
}
