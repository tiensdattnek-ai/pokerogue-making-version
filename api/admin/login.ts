/**
 * SPDX-FileCopyrightText: 2026 Arena Asxel Studio Games
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Admin account backend for **Arena Asxel Studio Games**.
 *
 * This file is deployed as a Vercel serverless function (Node.js runtime).
 *
 * Design notes:
 * - The admin credentials never leave the server. The browser only ever
 *   receives a signed, expiring session token, so inspecting the client
 *   bundle does not reveal the password.
 * - Passwords may be supplied either in plaintext (`ADMIN_PASSWORD`) or as a
 *   SHA-256 hex digest (`ADMIN_PASSWORD_SHA256`). The digest form is
 *   preferred.
 * - All comparisons are constant-time to avoid leaking information through
 *   response timing.
 *
 * Required environment variables:
 * - `ADMIN_USERNAME`         - the admin account name (default: `dat`)
 * - `ADMIN_PASSWORD_SHA256`  - SHA-256 hex digest of the password (preferred)
 *   or `ADMIN_PASSWORD`      - the password in plaintext
 * - `ADMIN_SESSION_SECRET`   - HMAC secret used to sign session tokens
 *   (falls back to a value derived from the password)
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Minimal structural typing of the Vercel request/response objects. */
interface AdminRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface AdminResponse {
  status(code: number): AdminResponse;
  json(payload: unknown): void;
  setHeader(name: string, value: string): void;
}

/** Payload embedded inside an admin session token. */
interface AdminTokenPayload {
  /** The account name the token was issued for. */
  sub: string;
  /** Issued-at timestamp, in seconds since the epoch. */
  iat: number;
  /** Expiry timestamp, in seconds since the epoch. */
  exp: number;
}

/** How long an admin session stays valid. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Environment variable names. */
const USERNAME_ENV = "ADMIN_USERNAME";
const PASSWORD_ENV = "ADMIN_PASSWORD";
const PASSWORD_HASH_ENV = "ADMIN_PASSWORD_SHA256";
const SECRET_ENV = "ADMIN_SESSION_SECRET";

/**
 * Best-effort brute force protection.
 *
 * Note: this is per-instance state, so it only provides a weak deterrent on
 * serverless platforms where instances are recycled frequently.
 */
const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

/** Constant-time string comparison. */
function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    // Compare the buffers against themselves so that the timing does not
    // depend on the length of the supplied value.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/** @returns The configured admin account name. */
function getAdminUsername(): string {
  return process.env[USERNAME_ENV] || "dat";
}

/** @returns The SHA-256 hex digest of the configured admin password. */
function getAdminPasswordHash(): string {
  const hash = process.env[PASSWORD_HASH_ENV];
  if (hash) {
    return hash.trim().toLowerCase();
  }
  const password = process.env[PASSWORD_ENV];
  if (password) {
    return sha256Hex(password);
  }
  return "";
}

/** @returns The HMAC secret used for signing session tokens. */
function getSessionSecret(): string {
  const secret = process.env[SECRET_ENV];
  if (secret) {
    return secret;
  }
  // Fall back to a secret derived from the password so that a deployment
  // without an explicit secret still produces unforgeable tokens.
  return sha256Hex(`arena-asxel-admin:${getAdminPasswordHash()}`);
}

/** @returns Whether the supplied credentials match the configured admin account. */
function verifyCredentials(username: string, password: string): boolean {
  const expectedHash = getAdminPasswordHash();
  if (!expectedHash) {
    console.error("No admin password configured on the server!");
    return false;
  }
  const usernameMatches = safeEquals(username, getAdminUsername());
  const passwordMatches = safeEquals(sha256Hex(password), expectedHash);
  // Evaluate both comparisons unconditionally.
  return usernameMatches && passwordMatches;
}

/** @returns A signed session token for the given account name. */
function issueToken(username: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    sub: username,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

/** @returns Whether the supplied token is valid and unexpired. */
function verifyToken(token: string): boolean {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return false;
  }
  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
  if (!safeEquals(signature, expectedSignature)) {
    return false;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminTokenPayload;
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/** @returns Whether the client has exceeded the attempt limit for this IP. */
function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const entry = attempts.get(clientKey);
  if (!entry || entry.resetAt <= now) {
    attempts.set(clientKey, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS_PER_WINDOW;
}

/** @returns The client identifier used for rate limiting. */
function getClientKey(req: AdminRequest): string {
  const forwarded = (req.headers?.["x-forwarded-for"] as string | undefined) ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

export default function handler(req: AdminRequest, res: AdminResponse): void {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const body = (req.body ?? {}) as {
    action?: string;
    username?: string;
    password?: string;
    token?: string;
  };

  const clientKey = getClientKey(req);

  if (body.action === "verify") {
    const token = body.token ?? "";
    if (!verifyToken(token)) {
      res.status(401).json({ ok: false, error: "Invalid or expired session" });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (isRateLimited(clientKey)) {
    res.status(429).json({ ok: false, error: "Too many attempts, please try again later" });
    return;
  }

  const username = body.username ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    res.status(400).json({ ok: false, error: "Username and password are required" });
    return;
  }

  if (!verifyCredentials(username, password)) {
    res.status(401).json({ ok: false, error: "Incorrect username or password" });
    return;
  }

  attempts.delete(clientKey);
  res.status(200).json({ ok: true, token: issueToken(username) });
}
