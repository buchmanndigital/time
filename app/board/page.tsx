import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { KanbanBoard } from "@/components/kanban-board";
import { getSession } from "@/lib/auth/session";
import { listCustomersByUserId } from "@/lib/data/customers";
import { listTasksByUserId } from "@/lib/data/tasks";
import { taskRowToKanbanDto } from "@/lib/kanban-task-dto";

export default async function BoardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [rows, customerRows] = await Promise.all([
    listTasksByUserId(session.userId),
    listCustomersByUserId(session.userId),
  ]);

  const initialTasks = rows.map(taskRowToKanbanDto);

  const customers = customerRows.map((c) => ({ id: c.id, name: c.name }));

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <div className="p-6 md:p-10">
        <KanbanBoard initialTasks={initialTasks} customers={customers} />
      </div>
    </AuthenticatedAppShell>
  );
}
