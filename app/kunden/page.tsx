import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { CreateCustomerForm } from "@/components/forms/create-customer-form";
import { KundenClientSection } from "@/components/kunden-client-section";
import { getSession } from "@/lib/auth/session";
import { listCustomersByUserId } from "@/lib/data/customers";

export default async function KundenPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const customers = await listCustomersByUserId(session.userId);
  const customerDtos = customers.map((c) => ({
    id: c.id,
    name: c.name,
    created_at:
      c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at),
  }));

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <div className="p-6 md:p-10">
        <div className="max-w-2xl space-y-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Kunden</h1>
            <p className="mt-2 text-sm text-foreground/55">
              Lege Kunden an und tippe in der Liste auf einen Namen, um ihn zu bearbeiten oder zu löschen.
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
              {customerDtos.length > 0 ? (
                <span className="ml-2 font-normal text-foreground/45">({customerDtos.length})</span>
              ) : null}
            </h2>
            <KundenClientSection initialCustomers={customerDtos} />
          </section>
        </div>
      </div>
    </AuthenticatedAppShell>
  );
}
