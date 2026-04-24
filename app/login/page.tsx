import Link from "next/link";
import { ViewportCenter } from "@/components/viewport-center";

type Props = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const p = await searchParams;
  const raw = p.error;
  const error =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0]
        : null;

  return (
    <ViewportCenter>
      <div className="flex flex-col items-center gap-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
          <p className="mt-1 text-sm text-foreground/60">Mit E-Mail und Passwort</p>
        </div>
        <form
          action="/api/auth/login"
          method="post"
          className="flex w-full max-w-sm flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/80">E-Mail</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-md border border-foreground/15 bg-background px-3 py-2 text-base text-foreground outline-none focus:border-foreground/40 md:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/80">Passwort</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-md border border-foreground/15 bg-background px-3 py-2 text-base text-foreground outline-none focus:border-foreground/40 md:text-sm"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            Anmelden
          </button>
        </form>
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
