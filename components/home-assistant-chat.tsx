"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAssistantChats } from "@/components/assistant-chats-context";
import { CHAT_MARKDOWN_COMPONENTS } from "@/components/chat-markdown-components";
import { cn } from "@/lib/utils/cn";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

function toStored(messages: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export function HomeAssistantChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatParam = searchParams.get("chat");
  const { refreshChats } = useAssistantChats();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [chatTitle, setChatTitle] = useState("");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const hasMessages = messages.length > 0;
  /** Thread-Ansicht auch bei ?chat= oder während Laden, damit nicht die leere Startansicht blinkt. */
  const showChatLayout = hasMessages || hydrating || Boolean(chatParam);

  useEffect(() => {
    if (hasMessages) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasMessages, toolStatus, loading]);

  useEffect(() => {
    if (titleEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [titleEditing]);

  useEffect(() => {
    if (!chatParam) {
      setMessages([]);
      setChatTitle("");
      setTitleEditing(false);
      setTitleError(null);
      setLoadError(null);
      setHydrating(false);
      return;
    }

    let cancelled = false;
    setHydrating(true);
    setLoadError(null);

    (async () => {
      try {
        const res = await fetch(`/api/assistant/chats/${encodeURIComponent(chatParam)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) {
            setLoadError("Chat nicht gefunden.");
            router.replace("/");
          }
          return;
        }
        const data = (await res.json()) as {
          title?: string;
          messages?: { role: string; content: string }[];
        };
        if (cancelled) return;
        setChatTitle(typeof data.title === "string" && data.title.trim() ? data.title : "Neuer Chat");
        setTitleEditing(false);
        setTitleError(null);
        const raw = data.messages ?? [];
        setMessages(
          raw.map((m) => ({
            id: crypto.randomUUID(),
            role: m.role === "assistant" ? "assistant" : "user",
            content: typeof m.content === "string" ? m.content : "",
          })),
        );
      } catch {
        if (!cancelled) setLoadError("Chat konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatParam, router]);

  const saveChatTitle = useCallback(async () => {
    if (!chatParam || titleSaving || hydrating) return;
    const t = titleDraft.trim();
    if (!t) {
      setTitleDraft(chatTitle);
      setTitleEditing(false);
      return;
    }
    if (t === chatTitle) {
      setTitleEditing(false);
      return;
    }
    setTitleSaving(true);
    setTitleError(null);
    try {
      const res = await fetch(`/api/assistant/chats/${encodeURIComponent(chatParam)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setTitleError(d.error ?? "Titel konnte nicht gespeichert werden.");
        return;
      }
      setChatTitle(t);
      setTitleDraft(t);
      setTitleEditing(false);
      await refreshChats();
    } catch {
      setTitleError("Netzwerkfehler.");
    } finally {
      setTitleSaving(false);
    }
  }, [chatParam, chatTitle, hydrating, refreshChats, titleDraft, titleSaving]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || hydrating) return;

    const prevSnapshot = messages;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const next = [...prevSnapshot, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setToolStatus(null);
    setError(null);

    let chatId = chatParam;

    try {
      if (!chatId) {
        const cr = await fetch("/api/assistant/chats", { method: "POST" });
        if (!cr.ok) {
          const d = (await cr.json().catch(() => ({}))) as { error?: string };
          setError(d.error ?? "Chat konnte nicht angelegt werden.");
          setMessages(prevSnapshot);
          return;
        }
        const created = (await cr.json()) as { id?: string };
        if (!created.id) {
          setError("Ungültige Server-Antwort.");
          setMessages(prevSnapshot);
          return;
        }
        chatId = created.id;
        const patchUser = await fetch(`/api/assistant/chats/${encodeURIComponent(chatId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: toStored([userMsg]) }),
        });
        if (!patchUser.ok) {
          const d = (await patchUser.json().catch(() => ({}))) as { error?: string };
          setError(d.error ?? "Nachricht konnte nicht gespeichert werden.");
          setMessages(prevSnapshot);
          return;
        }
        router.replace(`/?chat=${encodeURIComponent(chatId)}`);
        await refreshChats();
      }

      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Anfrage fehlgeschlagen.");
        if (chatId) {
          await fetch(`/api/assistant/chats/${encodeURIComponent(chatId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: toStored(next) }),
          }).catch(() => {});
        }
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Antwort-Stream nicht verfügbar.");
        if (chatId) {
          await fetch(`/api/assistant/chats/${encodeURIComponent(chatId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: toStored(next) }),
          }).catch(() => {});
        }
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const streamOutcome: { reply: string | null; error: string | null } = {
        reply: null,
        error: null,
      };

      const handleEvent = (o: Record<string, unknown>) => {
        if (o.type === "tool" && o.phase === "start" && typeof o.display === "string" && o.display) {
          setToolStatus(o.display);
          return;
        }
        if (o.type === "tool" && o.phase === "end") {
          const toolName = typeof o.name === "string" ? o.name : "";
          if (toolName === "web_research") {
            setToolStatus("Browser Use: Recherche abgeschlossen, Antwort wird erstellt …");
          } else {
            setToolStatus(null);
          }
          return;
        }
        if (o.type === "done" && typeof o.reply === "string") {
          streamOutcome.reply = o.reply;
          return;
        }
        if (o.type === "error" && typeof o.error === "string") {
          streamOutcome.error = o.error;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const o = JSON.parse(line) as Record<string, unknown>;
            handleEvent(o);
          } catch {
            /* Zeile kein JSON */
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          handleEvent(JSON.parse(tail) as Record<string, unknown>);
        } catch {
          /* ignore */
        }
      }

      if (streamOutcome.error) {
        setError(streamOutcome.error);
        if (chatId) {
          await fetch(`/api/assistant/chats/${encodeURIComponent(chatId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: toStored(next) }),
          }).catch(() => {});
        }
        return;
      }
      const replyText = streamOutcome.reply;
      if (replyText == null || replyText.length === 0) {
        setError("Leere Antwort vom Server.");
        if (chatId) {
          await fetch(`/api/assistant/chats/${encodeURIComponent(chatId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: toStored(next) }),
          }).catch(() => {});
        }
        return;
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: replyText,
      };
      const final = [...next, assistantMsg];
      setMessages(final);

      if (chatId) {
        const patchFull = await fetch(`/api/assistant/chats/${encodeURIComponent(chatId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: toStored(final) }),
        });
        if (!patchFull.ok) {
          setError("Antwort konnte nicht gespeichert werden.");
        }
        try {
          const tr = await fetch(`/api/assistant/chats/${encodeURIComponent(chatId)}/title`, {
            method: "POST",
          });
          if (tr.ok) {
            const td = (await tr.json().catch(() => ({}))) as { title?: string };
            if (typeof td.title === "string" && td.title.trim()) {
              setChatTitle(td.title);
              setTitleDraft(td.title);
            }
          }
        } catch {
          /* optional */
        }
        await refreshChats();
      }

      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
      if (chatId) {
        await fetch(`/api/assistant/chats/${encodeURIComponent(chatId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: toStored(next) }),
        }).catch(() => {});
      }
    } finally {
      setLoading(false);
      setToolStatus(null);
      textareaRef.current?.focus();
    }
  }, [chatParam, hydrating, input, loading, messages, refreshChats, router]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const composerDisabled = loading || hydrating;

  const composer = (
    <div className="relative w-full max-w-2xl">
      <div
        className={cn(
          "flex items-end gap-2 rounded-[1.35rem] border bg-background px-3 py-2 transition-[border-color,box-shadow]",
          "border-foreground/12 focus-within:border-teal-500/45 focus-within:ring-2 focus-within:ring-teal-500/20",
          "dark:focus-within:ring-teal-400/15",
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            hydrating ? "Chat wird geladen …" : "Nachricht an den Assistenten …"
          }
          disabled={composerDisabled}
          rows={1}
          className="max-h-48 min-h-[2.75rem] w-full resize-none bg-transparent py-2.5 pl-2 pr-2 text-base leading-relaxed text-foreground outline-none placeholder:text-foreground/35 disabled:opacity-60 md:text-[0.95rem]"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={composerDisabled || !input.trim()}
          className="mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white transition-opacity hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-teal-600 dark:hover:bg-teal-500"
          aria-label="Senden"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <SendIcon />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background md:min-h-[calc(100dvh-0px)]">
      {loadError ? (
        <div className="px-4 py-2 text-center text-sm text-red-600 dark:text-red-300" role="alert">
          {loadError}
        </div>
      ) : null}

      {!showChatLayout ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-8 md:px-8">
          {composer}
          {loading && toolStatus ? (
            <WebToolProgressBanner text={toolStatus} className="mt-6 max-w-2xl" />
          ) : loading ? (
            <p className="mt-6 text-center text-sm text-foreground/45">Denkt nach …</p>
          ) : null}
        </div>
      ) : (
        <>
          {chatParam ? (
            <div className="shrink-0 border-b border-foreground/10 bg-background/95 px-3 py-3 backdrop-blur-sm md:px-8">
              <div className="mx-auto max-w-2xl">
                <label className="sr-only" htmlFor="chat-title-input">
                  Chat-Titel
                </label>
                {titleEditing ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        id="chat-title-input"
                        ref={titleInputRef}
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={() => void saveChatTitle()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveChatTitle();
                          }
                          if (e.key === "Escape") {
                            setTitleDraft(chatTitle);
                            setTitleEditing(false);
                            setTitleError(null);
                          }
                        }}
                        maxLength={200}
                        disabled={titleSaving || hydrating}
                        className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
                      />
                      {titleSaving ? (
                        <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600" />
                      ) : null}
                    </div>
                    {titleError ? (
                      <p className="text-xs text-red-600 dark:text-red-300">{titleError}</p>
                    ) : (
                      <p className="text-xs text-foreground/45">Enter speichert, Esc bricht ab.</p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(chatTitle);
                      setTitleError(null);
                      setTitleEditing(true);
                    }}
                    disabled={hydrating}
                    className="group flex w-full max-w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-foreground/5 disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                      {hydrating ? "…" : chatTitle.trim() || "Neuer Chat"}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-teal-700 opacity-80 group-hover:opacity-100 dark:text-teal-400">
                      Titel ändern
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-3 py-6 md:px-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-5">
              {hydrating ? (
                <p className="text-center text-sm text-foreground/45">Verlauf wird geladen …</p>
              ) : null}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[min(100%,42rem)] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed",
                      m.role === "user"
                        ? "bg-teal-600 text-white dark:bg-teal-700"
                        : "border border-foreground/10 bg-foreground/[0.04] text-foreground/90",
                    )}
                  >
                    <MessageBody text={m.content} isUser={m.role === "user"} />
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  {toolStatus ? (
                    <WebToolProgressBanner text={toolStatus} />
                  ) : (
                    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-4 py-3 text-sm text-foreground/50">
                      Denkt nach …
                    </div>
                  )}
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-foreground/10 bg-background/90 px-3 py-4 backdrop-blur-md md:px-8">
            <div className="mx-auto max-w-2xl">
              {error ? (
                <p
                  className="mb-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {composer}
            </div>
          </div>
        </>
      )}

      {!showChatLayout && error ? (
        <div className="mx-auto mt-4 w-full max-w-xl px-4">
          <p
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
            role="alert"
          >
            {error}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function WebToolProgressBanner({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,42rem)] rounded-2xl border border-teal-500/30 bg-teal-500/[0.08] px-4 py-3 text-sm dark:bg-teal-400/[0.07]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-teal-600 dark:bg-teal-500" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-wide text-teal-800 dark:text-teal-200">Browser Use</p>
          <p className="mt-1 text-foreground/75">{text}</p>
        </div>
      </div>
    </div>
  );
}

function MessageBody({ text, isUser }: { text: string; isUser: boolean }) {
  return (
    <div
      className={cn(
        "break-words leading-relaxed [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/25 [&_blockquote]:pl-3 [&_blockquote]:text-foreground/80",
        "[&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]",
        "[&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold",
        "[&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_p]:mb-2 [&_p:last-child]:mb-0",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-foreground/10 [&_pre]:p-3",
        "[&_strong]:font-semibold",
        "[&_a]:underline [&_a]:underline-offset-2",
        isUser && "[&_a]:text-white/95 [&_code]:bg-white/15 [&_strong]:text-white",
        !isUser && "[&_a]:text-teal-700 dark:[&_a]:text-teal-400",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={CHAT_MARKDOWN_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.4 20.4 21 12 3.4 3.6l1.8 6.6L15 12l-9.8 1.8z" />
    </svg>
  );
}
