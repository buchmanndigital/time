import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { KanbanBoard } from "@/components/kanban-board";
import { getSession } from "@/lib/auth/session";
import { listTasksByUserId } from "@/lib/data/tasks";

export default async function BoardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const rows = await listTasksByUserId(session.userId);
  const initialTasks = rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    created_at:
      t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
  }));

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <div className="p-6 md:p-10">
        <KanbanBoard initialTasks={initialTasks} />
      </div>
    </AuthenticatedAppShell>
  );
}
