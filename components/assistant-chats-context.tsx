"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AssistantChatListEntry = {
  id: string;
  title: string;
  updated_at: string;
};

type AssistantChatsContextValue = {
  chats: AssistantChatListEntry[];
  refreshChats: () => Promise<void>;
  deleteChat: (id: string) => Promise<boolean>;
};

const AssistantChatsContext = createContext<AssistantChatsContextValue | null>(null);

export function useAssistantChats(): AssistantChatsContextValue {
  const ctx = useContext(AssistantChatsContext);
  if (!ctx) {
    throw new Error("useAssistantChats nur innerhalb von AssistantChatsProvider");
  }
  return ctx;
}

export function AssistantChatsProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<AssistantChatListEntry[]>([]);

  const refreshChats = useCallback(async () => {
    try {
      const res = await fetch("/api/assistant/chats", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { chats?: AssistantChatListEntry[] };
      setChats(Array.isArray(data.chats) ? data.chats : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshChats();
  }, [refreshChats]);

  const deleteChat = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/assistant/chats/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) return false;
        await refreshChats();
        return true;
      } catch {
        return false;
      }
    },
    [refreshChats],
  );

  const value = useMemo(
    () => ({
      chats,
      refreshChats,
      deleteChat,
    }),
    [chats, refreshChats, deleteChat],
  );

  return <AssistantChatsContext.Provider value={value}>{children}</AssistantChatsContext.Provider>;
}
