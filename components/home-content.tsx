import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { AuthStatus } from "@/components/auth-status";
import { HomeAssistantChat } from "@/components/home-assistant-chat";
import { TimeTitle } from "@/components/time-title";
import { ViewportCenter } from "@/components/viewport-center";
import { getSession } from "@/lib/auth/session";

export async function HomeContent() {
  const session = await getSession();

  if (!session) {
    return (
      <ViewportCenter>
        <div className="flex flex-col items-center gap-10">
          <TimeTitle />
          <AuthStatus />
        </div>
      </ViewportCenter>
    );
  }

  return (
    <AuthenticatedAppShell userEmail={session.email}>
      <HomeAssistantChat />
    </AuthenticatedAppShell>
  );
}
