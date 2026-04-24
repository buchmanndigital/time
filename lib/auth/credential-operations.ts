import { randomUUID } from "crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import { createUser, emailExists, findUserByEmail } from "@/lib/data/users";

export type AuthFormState = { error?: string };

function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function checkAuthConfig(): AuthFormState | null {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      error:
        "DATABASE_URL fehlt. Lege in .env.local den Neon-Connection-String an (siehe .env.example). Server neu starten.",
    };
  }
  if ((process.env.AUTH_SECRET?.trim() ?? "").length < 16) {
    return {
      error:
        "AUTH_SECRET fehlt oder ist kürzer als 16 Zeichen. In .env.local setzen (siehe .env.example). Server neu starten.",
    };
  }
  return null;
}

function authUnexpectedError(context: string, e: unknown): AuthFormState {
  console.error(`[auth] ${context}`, e);
  const msg = e instanceof Error ? e.message : String(e);
  // Neon: HTTP 402 / eingefrorener Free-Tier / Compute-Quote
  if (
    /exceeded the compute time quota|status 402|HTTP status 402/i.test(msg) ||
    (/compute/i.test(msg) && /quota/i.test(msg))
  ) {
    return {
      error:
        "Datenbank (Neon): Speicher- oder Compute-Limit erreicht. In https://console.neon.tech dein Projekt öffnen — ggf. Plan upgraden, Zahlung hinterlegen oder bis zur nächsten Abrechnungsperiode warten, bis wieder Kapazität frei ist.",
    };
  }
  return {
    error:
      "Anmeldung derzeit nicht möglich. Bitte kurz warten und erneut versuchen. Wenn das so bleibt, prüfe DATABASE_URL und die Datenbankverbindung.",
  };
}

/** Leeres Objekt = Erfolg (kein error-Feld). */
export async function runRegisterFromFormData(
  formData: FormData,
): Promise<AuthFormState> {
  const misconfigured = checkAuthConfig();
  if (misconfigured) return misconfigured;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-Mail und Passwort sind erforderlich." };
  }
  if (!validateEmail(email)) {
    return { error: "Bitte gültige E-Mail angeben." };
  }
  if (password.length < 8) {
    return { error: "Passwort mindestens 8 Zeichen." };
  }

  let exists: boolean;
  try {
    exists = await emailExists(email);
  } catch (e) {
    return authUnexpectedError("register emailExists", e);
  }
  if (exists) {
    return { error: "Diese E-Mail ist bereits registriert." };
  }

  try {
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    await createUser(id, email, passwordHash);
    await setSession({ userId: id, email });
  } catch (e) {
    return authUnexpectedError("register", e);
  }
  return {};
}

/** Leeres Objekt = Erfolg. */
export async function runLoginFromFormData(formData: FormData): Promise<AuthFormState> {
  const misconfigured = checkAuthConfig();
  if (misconfigured) return misconfigured;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-Mail und Passwort sind erforderlich." };
  }

  let user: Awaited<ReturnType<typeof findUserByEmail>>;
  try {
    user = await findUserByEmail(email);
  } catch (e) {
    return authUnexpectedError("login findUser", e);
  }

  if (!user) {
    return { error: "Anmeldung fehlgeschlagen." };
  }

  try {
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return { error: "Anmeldung fehlgeschlagen." };
    }
  } catch (e) {
    return authUnexpectedError("login verifyPassword", e);
  }

  try {
    await setSession({ userId: user.id, email: user.email });
  } catch (e) {
    return authUnexpectedError("login setSession", e);
  }
  return {};
}
