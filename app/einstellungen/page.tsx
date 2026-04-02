import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { TaskNotificationSettingsPanel } from "@/components/task-notification-context";
import { ImapEmailSettingsSection } from "@/components/imap-email-settings";
import { WebPushSettingsSection } from "@/components/web-push-settings";
import { getSession } from "@/lib/auth/session";

export default async function EinstellungenPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <div className="mx-auto max-w-2xl space-y-10 p-6 md:p-10">
        <header>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Einstellungen</h1>
          <p className="mt-2 text-sm text-foreground/55">
            Passe Mitteilungen und weitere Optionen an. Erweiterungen folgen bei Bedarf hier.
          </p>
        </header>

        <TaskNotificationSettingsPanel headingLevel="h2" />

        <WebPushSettingsSection headingLevel="h2" />

        <ImapEmailSettingsSection headingLevel="h2" />
      </div>
    </AuthenticatedAppShell>
  );
}
