"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAssistantChats } from "@/components/assistant-chats-context";
import { cn } from "@/lib/utils/cn";

export function AssistantChatsSidebarSection({ onNavigate }: { onNavigate?: () => void }) {
  const { chats, deleteChat } = useAssistantChats();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("chat");

  async function handleDelete(chatId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (activeId === chatId) {
      router.push("/");
    }
    await deleteChat(chatId);
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Gespeicherte Chats">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Meine Chats</h2>
        <Link
          href="/"
          onClick={onNavigate}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-500/10 dark:text-teal-400"
        >
          Neu
        </Link>
      </div>

      {chats.length === 0 ? (
        <p className="px-1 text-xs text-foreground/45">Noch keine gespeicherten Chats.</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto pr-1">
          {chats.map((c) => {
            const active = activeId === c.id;
            return (
              <li key={c.id}>
                <div
                  className={cn(
                    "group flex items-stretch gap-0.5 rounded-lg transition-colors",
                    active ? "bg-foreground/10" : "hover:bg-foreground/5",
                  )}
                >
                  <Link
                    href={`/?chat=${encodeURIComponent(c.id)}`}
                    onClick={onNavigate}
                    title={c.title}
                    className={cn(
                      "min-w-0 flex-1 truncate px-3 py-2 text-sm font-medium",
                      active ? "text-foreground" : "text-foreground/75",
                    )}
                  >
                    {c.title}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => void handleDelete(c.id, e)}
                    className="flex w-8 shrink-0 items-center justify-center rounded-r-lg text-foreground/40 opacity-70 transition-opacity hover:bg-red-500/15 hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
                    aria-label={`Chat „${c.title}“ löschen`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
