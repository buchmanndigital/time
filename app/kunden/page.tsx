import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { getSession } from "@/lib/auth/session";

export default async function KundenPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <div className="p-6 md:p-10">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Kunden</h1>
        <p className="mt-2 max-w-xl text-sm text-foreground/55">
          Hier kann später die Kundenverwaltung ergänzt werden.
        </p>
      </div>
    </AuthenticatedAppShell>
  );
}
