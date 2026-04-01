import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { LogoutForm } from "@/components/forms/logout-form";

export async function AuthStatus() {
  const session = await getSession();

  if (!session) {
    return (
      <nav className="flex gap-3 text-sm text-foreground/70">
        <Link href="/register" className="underline underline-offset-4 hover:text-foreground">
          Registrieren
        </Link>
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          Anmelden
        </Link>
      </nav>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-sm text-foreground/80">
      <span>{session.email}</span>
      <LogoutForm />
    </div>
  );
}
