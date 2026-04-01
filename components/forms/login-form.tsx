"use client";

import { useActionState } from "react";
import { login, type AuthFormState } from "@/app/actions/auth";

const initial: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/80">E-Mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-md border border-foreground/15 bg-background px-3 py-2 text-foreground outline-none focus:border-foreground/40"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/80">Passwort</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-foreground/15 bg-background px-3 py-2 text-foreground outline-none focus:border-foreground/40"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "…" : "Anmelden"}
      </button>
    </form>
  );
}
