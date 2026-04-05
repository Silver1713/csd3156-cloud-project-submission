import { randomBytes } from "node:crypto";

import type { OrganizationRow } from "../types/organizations.db.types.js";

const JOIN_KEY_PATTERN = /^[A-Z0-9]{8}$/;
const GENERATED_JOIN_KEY_ATTEMPTS = 8;

export function normalizeOrganizationJoinKey(
  joinKey: string | null | undefined,
): string | null {
  const normalized = joinKey?.trim().toUpperCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function isOrganizationJoinKeyValid(
  joinKey: string | null | undefined,
): joinKey is string {
  return typeof joinKey === "string" && JOIN_KEY_PATTERN.test(joinKey);
}

export function generateOrganizationJoinKey(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(8);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function isJoinKeyUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    "constraint" in error &&
    (error as { code?: string }).code === "23505" &&
    (error as { constraint?: string }).constraint === "organizations_join_key_key"
  );
}

export async function createOrganizationWithGeneratedJoinKeyInTransaction<TClient>(
  client: TClient,
  name: string,
  createOrganizationInTransaction: (
    client: TClient,
    name: string,
    joinKey: string,
  ) => Promise<OrganizationRow>,
): Promise<OrganizationRow> {
  let lastError: unknown;

  for (let attempt = 0; attempt < GENERATED_JOIN_KEY_ATTEMPTS; attempt += 1) {
    const joinKey = generateOrganizationJoinKey();

    try {
      return await createOrganizationInTransaction(client, name, joinKey);
    } catch (error) {
      if (!isJoinKeyUniqueViolation(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError ?? new Error("Failed to generate a unique organization join key");
}
