import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(payload) {
  return createHmac("sha256", process.env.AUTH_SECRET).update(payload).digest("base64url");
}

export function createSessionToken(email) {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const payload = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expectedSig = Buffer.from(sign(payload));
  if (sig.length !== expectedSig.length || !timingSafeEqual(sig, expectedSig)) return null;

  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!email || !exp || Date.now() > exp) return null;
    return { email };
  } catch {
    return null;
  }
}
