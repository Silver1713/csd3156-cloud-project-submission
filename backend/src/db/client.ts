/**
 * Shared PostgreSQL pool and query helper used by repository modules.
 */
import { Pool, type PoolConfig, type QueryResultRow } from "pg";

const CONNECTION_STRING_ENV_NAMES = [
  "POSTGRES_SSL_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
] as const;

function parseBooleanEnvironmentFlag(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();

  if (normalized === undefined || normalized === "") {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function getConnectionString(env: NodeJS.ProcessEnv): string | undefined {
  for (const name of CONNECTION_STRING_ENV_NAMES) {
    const value = env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function shouldEnableSslFromConnectionString(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const ssl = url.searchParams.get("ssl");
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

    return (
      parseBooleanEnvironmentFlag(ssl ?? undefined) === true ||
      ["require", "verify-ca", "verify-full"].includes(sslMode ?? "")
    );
  } catch {
    return false;
  }
}

export function createPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const connectionString = getConnectionString(env);
  const sslRequested =
    parseBooleanEnvironmentFlag(env.DB_SSL) ??
    (connectionString ? shouldEnableSslFromConnectionString(connectionString) : false);
  const rejectUnauthorized = parseBooleanEnvironmentFlag(env.DB_SSL_REJECT_UNAUTHORIZED) ?? false;
  const ssl = sslRequested ? { rejectUnauthorized } : undefined;

  if (connectionString) {
    return {
      connectionString,
      ssl,
    };
  }

  return {
    host: env.DB_HOST ?? "localhost",
    port: Number(env.DB_PORT ?? 5432),
    database: env.DB_NAME ?? "inventory",
    user: env.DB_USER ?? "postgres",
    password: env.DB_PASSWORD ?? "password",
    ssl,
  };
}

const pool = new Pool(createPoolConfig());

/**
 * Executes a parameterized SQL query and returns only the typed row payload.
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, [...params]);
  return result.rows;
}

export { pool };
