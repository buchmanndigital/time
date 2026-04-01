import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";
import { ViewportCenter } from "@/components/viewport-center";

export default function LoginPage() {
  return (
    <ViewportCenter>
      <div className="flex flex-col items-center gap-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
          <p className="mt-1 text-sm text-foreground/60">Mit E-Mail und Passwort</p>
        </div>
        <LoginForm />
        <p className="text-sm text-foreground/60">
          Noch kein Konto?{" "}
          <Link href="/register" className="underline underline-offset-4">
            Registrieren
          </Link>
        </p>
      </div>
    </ViewportCenter>
  );
}
