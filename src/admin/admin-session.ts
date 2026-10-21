/**
 * SPDX-FileCopyrightText: 2026 Arena Asxel Studio Games
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Client-side admin session handling for **Arena Asxel Studio Games**.
 *
 * The session token is issued by the `api/admin/login` serverless function and
 * is stored in `localStorage`. The password itself is never sent to - or
 * stored by - the browser.
 */

/** The `localStorage` key holding the admin session token. */
const TOKEN_STORAGE_KEY = "arena_admin_token";

/** The endpoint of the admin backend. */
const ADMIN_ENDPOINT = "/api/admin/login";

/** The result of an admin login attempt. */
export interface AdminLoginResult {
  /** Whether the login attempt succeeded. */
  success: boolean;
  /** A human readable error message, if the attempt failed. */
  error?: string;
  /** The account name that was authenticated. */
  username?: string;
}

/**
 * Send a request to the admin backend.
 * @param payload The request body.
 * @returns The parsed response, or `null` if the backend could not be reached.
 */
async function requestAdminBackend(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; token?: string; error?: string } | null> {
  try {
    const response = await fetch(ADMIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { ok: boolean; token?: string; error?: string };
    return data;
  } catch (error) {
    console.error("Could not reach the admin backend:", error);
    return null;
  }
}

/**
 * Log in with the admin account credentials.
 * @param username The account name.
 * @param password The account password.
 * @returns Whether the login succeeded, along with any error message.
 */
export async function adminLogin(username: string, password: string): Promise<AdminLoginResult> {
  const data = await requestAdminBackend({ action: "login", username, password });

  if (!data) {
    return { success: false, error: "Could not reach the admin server" };
  }
  if (!data.ok || !data.token) {
    return { success: false, error: data.error ?? "Incorrect username or password" };
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
  return { success: true, username };
}

/**
 * Restore a previously saved admin session.
 * @returns Whether a valid session could be restored.
 */
export async function adminRestoreSession(): Promise<boolean> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    return false;
  }

  const data = await requestAdminBackend({ action: "verify", token });
  if (!data?.ok) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return false;
  }
  return true;
}

/** End the current admin session and clear the stored token. */
export function adminLogout(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * @returns Whether an admin session token is currently stored.
 * @remarks
 * This is a *local* check only. It is used purely to decide whether to show
 * admin UI; the actual authentication is performed by the serverless function.
 */
export function hasAdminToken(): boolean {
  return !!localStorage.getItem(TOKEN_STORAGE_KEY);
}
