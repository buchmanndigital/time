import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { TaskCalendar } from "@/components/task-calendar";
import { getSession } from "@/lib/auth/session";
import { listCustomersByUserId } from "@/lib/data/customers";
import { listTasksByUserId } from "@/lib/data/tasks";

export default async function KalenderPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [rows, customerRows] = await Promise.all([
    listTasksByUserId(session.userId),
    listCustomersByUserId(session.userId),
  ]);

  const tasks = rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    created_at:
      t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
    starts_at:
      t.starts_at == null
        ? null
        : t.starts_at instanceof Date
          ? t.starts_at.toISOString()
          : String(t.starts_at),
    duration_minutes: t.duration_minutes ?? null,
    customer_id: t.customer_id ?? null,
    customer_name: t.customer_name ?? null,
  }));

  const customers = customerRows.map((c) => ({ id: c.id, name: c.name }));

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <div className="p-5 md:p-10">
        <TaskCalendar tasks={tasks} customers={customers} />
      </div>
    </AuthenticatedAppShell>
  );
}
