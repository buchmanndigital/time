"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/cn";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export function HomeAssistantChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  /** Länger laufende Tool-Aktion (z. B. Browser Use Web-Recherche), live per Stream */
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (hasMessages) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasMessages, toolStatus, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setToolStatus(null);
    setError(null);

    try {
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
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Antwort-Stream nicht verfügbar.");
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
        return;
      }
      const replyText = streamOutcome.reply;
      if (replyText == null || replyText.length === 0) {
        setError("Leere Antwort.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: replyText },
      ]);
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
      setToolStatus(null);
      textareaRef.current?.focus();
    }
  }, [input, loading, messages, router]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

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
          placeholder="Nachricht an den Assistenten …"
          disabled={loading}
          rows={1}
          className="max-h-48 min-h-[2.75rem] w-full resize-none bg-transparent py-2.5 pl-2 pr-2 text-base leading-relaxed text-foreground outline-none placeholder:text-foreground/35 disabled:opacity-60 md:text-[0.95rem]"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
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
      {!hasMessages ? (
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
          <div className="flex-1 overflow-y-auto px-3 py-6 md:px-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-5">
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

      {!hasMessages && error ? (
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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
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
