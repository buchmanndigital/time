"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clearSession, setSession } from "@/lib/auth/session";
import { createUser, emailExists, findUserByEmail } from "@/lib/data/users";

export type AuthFormState = { error?: string };

function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function authConfigError(): AuthFormState | null {
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

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const misconfigured = authConfigError();
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

  if (await emailExists(email)) {
    return { error: "Diese E-Mail ist bereits registriert." };
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await createUser(id, email, passwordHash);
  await setSession({ userId: id, email });
  redirect("/");
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const misconfigured = authConfigError();
  if (misconfigured) return misconfigured;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-Mail und Passwort sind erforderlich." };
  }

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Anmeldung fehlgeschlagen." };
  }

  await setSession({ userId: user.id, email: user.email });
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
