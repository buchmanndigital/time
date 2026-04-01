import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { TaskCalendar } from "@/components/task-calendar";
import { getSession } from "@/lib/auth/session";
import { listCustomersByUserId } from "@/lib/data/customers";
import { listTasksByUserId } from "@/lib/data/tasks";
import { taskRowToKanbanDto } from "@/lib/kanban-task-dto";

export default async function KalenderPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [rows, customerRows] = await Promise.all([
    listTasksByUserId(session.userId),
    listCustomersByUserId(session.userId),
  ]);

  const tasks = rows.map(taskRowToKanbanDto);

  const customers = customerRows.map((c) => ({ id: c.id, name: c.name }));

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <div className="p-5 md:p-10">
        <TaskCalendar tasks={tasks} customers={customers} />
      </div>
    </AuthenticatedAppShell>
  );
}
