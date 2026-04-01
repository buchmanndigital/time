"use client";

import { logout } from "@/app/actions/auth";

export function LogoutForm() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm underline underline-offset-4 hover:text-foreground/80"
      >
        Abmelden
      </button>
    </form>
  );
}
