"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { insertCustomer } from "@/lib/data/customers";

export type CustomerFormState = { error?: string };

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
