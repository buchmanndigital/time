import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { CreateCustomerForm } from "@/components/forms/create-customer-form";
import { getSession } from "@/lib/auth/session";
import { listCustomersByUserId } from "@/lib/data/customers";

export default async function KundenPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const customers = await listCustomersByUserId(session.userId);

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <div className="p-6 md:p-10">
        <div className="max-w-2xl space-y-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Kunden</h1>
            <p className="mt-2 text-sm text-foreground/55">
              Lege Kunden mit einem Namen an. Weitere Felder folgen später.
            </p>
          </div>

          <section aria-labelledby="kunden-neu-heading">
            <h2 id="kunden-neu-heading" className="mb-3 text-sm font-medium text-foreground">
              Neuer Kunde
            </h2>
            <CreateCustomerForm />
          </section>

          <section aria-labelledby="kunden-liste-heading">
            <h2 id="kunden-liste-heading" className="mb-3 text-sm font-medium text-foreground">
              Alle Kunden
              {customers.length > 0 ? (
                <span className="ml-2 font-normal text-foreground/45">({customers.length})</span>
              ) : null}
            </h2>
            {customers.length === 0 ? (
              <p className="text-sm text-foreground/50">Noch keine Kunden angelegt.</p>
            ) : (
              <ul className="divide-y divide-foreground/10 rounded-xl border border-foreground/10">
                {customers.map((c) => (
                  <li
                    key={c.id}
                    className="px-4 py-3 text-sm text-foreground first:rounded-t-xl last:rounded-b-xl"
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AuthenticatedAppShell>
  );
}
