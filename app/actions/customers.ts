"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  deleteCustomerForUser,
  findCustomerByIdForUser,
  insertCustomer,
  updateCustomerForUser,
} from "@/lib/data/customers";

export type CustomerFormState = { error?: string };

export type CustomerMutationResult = { ok: true } | { ok: false; error: string };

const MAX_NAME = 200;

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await getSession();
  if (!session) {
    return { error: "Nicht angemeldet." };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { error: "Datenbank nicht konfiguriert." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME);
  if (!name) {
    return { error: "Bitte einen Namen eingeben." };
  }

  try {
    await insertCustomer(randomUUID(), session.userId, name);
    revalidatePath("/kunden");
    return {};
  } catch {
    return { error: "Kunde konnte nicht gespeichert werden." };
  }
}

export async function updateCustomerDetails(
  customerId: string,
  rawName: string,
): Promise<CustomerMutationResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Nicht angemeldet." };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }

  const name = String(rawName ?? "").trim().slice(0, MAX_NAME);
  if (!name) {
    return { ok: false, error: "Name darf nicht leer sein." };
  }

  const existing = await findCustomerByIdForUser(customerId, session.userId);
  if (!existing) {
    return { ok: false, error: "Kunde nicht gefunden." };
  }

  try {
    const row = await updateCustomerForUser(customerId, session.userId, name);
    if (!row) {
      return { ok: false, error: "Speichern fehlgeschlagen." };
    }
    revalidatePath("/kunden");
    revalidatePath("/board");
    revalidatePath("/kalender");
    return { ok: true };
  } catch {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
}

export async function deleteCustomerById(customerId: string): Promise<CustomerMutationResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Nicht angemeldet." };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }

  try {
    const ok = await deleteCustomerForUser(customerId, session.userId);
    if (!ok) {
      return { ok: false, error: "Kunde nicht gefunden." };
    }
    revalidatePath("/kunden");
    revalidatePath("/board");
    revalidatePath("/kalender");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Löschen fehlgeschlagen." };
  }
}
