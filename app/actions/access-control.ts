"use server";

import crypto from "crypto";
import { cookies } from "next/headers";

const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD?.trim() ?? "";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const ACCESS_COOKIE = "dreamint-access";

const ACCESS_DISABLED_RESPONSE = {
  enabled: false,
  valid: true,
  token: null as string | null,
};

const deriveSecret = (password: string) =>
  crypto.createHash("sha256").update(`dreamint-access::${password}`, "utf8").digest();

const isPasswordConfigured = () => ACCESS_PASSWORD.length > 0;
const secret = isPasswordConfigured() ? deriveSecret(ACCESS_PASSWORD) : null;

const signToken = (secretKey: Buffer, expiresAt: number) => {
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(String(expiresAt));
  return `${expiresAt}.${hmac.digest("hex")}`;
};

const verifyToken = (secretKey: Buffer, token: string) => {
  const [expiresRaw] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const expected = signToken(secretKey, expiresAt);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(token);

  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
};

const issueToken = (secretKey: Buffer) => {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return { token: signToken(secretKey, expiresAt), expiresAt };
};

const clearSession = async () => {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
};

const persistSession = async (token: string, expiresAt: number) => {
  const store = await cookies();
  store.set({
    name: ACCESS_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    expires: new Date(expiresAt),
  });
};

export async function checkAccessSession() {
  if (!isPasswordConfigured() || !secret) {
    await clearSession();
    return ACCESS_DISABLED_RESPONSE;
  }

  const store = await cookies();
  const storedToken = store.get(ACCESS_COOKIE)?.value ?? "";
  if (!storedToken || !verifyToken(secret, storedToken)) {
    await clearSession();
    return { enabled: true, valid: false, token: null };
  }

  const { token, expiresAt } = issueToken(secret);
  await persistSession(token, expiresAt);

  return { enabled: true, valid: true, token: null };
}

export async function verifyAccessPassword(password: string) {
  if (!isPasswordConfigured() || !secret) {
    await clearSession();
    return ACCESS_DISABLED_RESPONSE;
  }

  const normalizedPassword = password?.trim() ?? "";
  const providedSecret = deriveSecret(normalizedPassword);

  if (
    providedSecret.length !== secret.length ||
    !crypto.timingSafeEqual(providedSecret, secret)
  ) {
    await clearSession();
    return { enabled: true, valid: false, token: null };
  }

  const { token, expiresAt } = issueToken(secret);
  await persistSession(token, expiresAt);

  return { enabled: true, valid: true, token: null };
}
