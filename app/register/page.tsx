import Link from "next/link";
import { RegisterForm } from "@/components/forms/register-form";
import { ViewportCenter } from "@/components/viewport-center";

export default function RegisterPage() {
  return (
    <ViewportCenter>
      <div className="flex flex-col items-center gap-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Registrieren</h1>
          <p className="mt-1 text-sm text-foreground/60">Neues Konto mit E-Mail und Passwort</p>
        </div>
        <RegisterForm />
        <p className="text-sm text-foreground/60">
          Schon ein Konto?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Anmelden
          </Link>
        </p>
      </div>
    </ViewportCenter>
  );
}
