"use client";

import { useActionState } from "react";
import { createCustomer, type CustomerFormState } from "@/app/actions/customers";

const initial: CustomerFormState = {};

export function CreateCustomerForm() {
  const [state, formAction, pending] = useActionState(createCustomer, initial);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/80">Name</span>
        <input
          name="name"
          type="text"
          autoComplete="organization"
          required
          maxLength={200}
          placeholder="z. B. Firma Muster GmbH"
          className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-base text-foreground outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/15 md:text-sm"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Wird gespeichert…" : "Kunde anlegen"}
      </button>
    </form>
  );
}
