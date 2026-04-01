import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "time_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error("AUTH_SECRET fehlt oder ist zu kurz (min. 16 Zeichen).");
  }
  return new TextEncoder().encode(raw);
}

export type SessionPayload = { userId: string; email: string };

export async function getSession(): Promise<SessionPayload | null> {
  if (!process.env.AUTH_SECRET) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.sub as string | undefined;
    const email = payload.email as string | undefined;
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
