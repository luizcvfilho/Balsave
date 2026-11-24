import "server-only";

import { scrypt, timingSafeEqual } from "node:crypto";
import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";

export const sessionCookie = "__Host-balsave-session";

export function configuredOrigin() {
  try {
    const url = new URL(process.env.BALSAVE_APP_ORIGIN ?? "http://localhost:8080");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol === "https:" || (loopback && url.protocol === "http:")) return url.origin;
  } catch {
    return undefined;
  }
}

export function authEnabled() {
  return Boolean(configuredOrigin() && /^[!-~]{32,}$/.test(process.env.BALSAVE_AUTH_SECRET ?? "")
    && (process.env.BALSAVE_BETTER_AUTH_SECRET?.length ?? 0) >= 32
    && process.env.BALSAVE_IDENTITY_DB_PASSWORD);
}

async function verifyCredential({ hash, password }: { hash: string; password: string }) {
  if (!hash.startsWith("scrypt-v1$")) return verifyPassword({ hash, password });

  // Preserve the exact UTF-8 input for passwords imported from the old login.
  const [, salt, expected] = /^scrypt-v1\$([\da-f]{32})\$([\da-f]{64})$/.exec(hash) ?? [];
  if (!salt || !expected) return false;
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, Buffer.from(salt, "hex"), 32, { N: 65536, r: 8, p: 2, maxmem: 80 * 2 ** 20 },
      (error, key) => error ? reject(error) : resolve(key));
  });
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function createAuth() {
  const pool = new Pool({
    host: process.env.BALSAVE_IDENTITY_DB_HOST ?? "localhost",
    port: Number(process.env.BALSAVE_IDENTITY_DB_PORT ?? 5432),
    database: "balsave",
    user: "balsave_identity",
    password: process.env.BALSAVE_IDENTITY_DB_PASSWORD,
    max: 5,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 3_000,
  });
  pool.on("error", () => console.error("Identity database connection lost."));

  return betterAuth({
    appName: "Balsave",
    baseURL: configuredOrigin(),
    secret: process.env.BALSAVE_BETTER_AUTH_SECRET,
    database: {
      dialect: new PostgresDialect({ pool }),
      type: "postgres",
      schemaName: "balsave_identity",
      transaction: true,
    },
    logger: { disabled: true },
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 1,
      maxPasswordLength: Number.MAX_SAFE_INTEGER,
      password: { hash: hashPassword, verify: verifyCredential },
    },
    session: { expiresIn: 8 * 60 * 60, disableSessionRefresh: true },
    advanced: {
      database: { generateId: "uuid" },
      ipAddress: { disableIpTracking: true },
      // The explicit host-only prefix already includes the secure cookie requirement.
      useSecureCookies: false,
      defaultCookieAttributes: { secure: true, sameSite: "strict" },
      cookies: { session_token: { name: sessionCookie } },
    },
    databaseHooks: {
      session: {
        create: {
          before: async () => ({ data: { userAgent: null } }),
        },
      },
    },
    plugins: [nextCookies()],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  if (!authEnabled()) throw new Error("Application authentication is unavailable");
  auth ??= createAuth();
  return auth;
}
