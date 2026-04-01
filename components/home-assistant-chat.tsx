"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export function HomeAssistantChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (hasMessages) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasMessages]);

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
    setError(null);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Anfrage fehlgeschlagen.");
        return;
      }
      if (!data.reply?.length) {
        setError("Leere Antwort.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.reply! },
      ]);
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
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
    <div
      className={cn(
        "relative w-full max-w-2xl",
        !hasMessages && "shadow-lg shadow-foreground/[0.03]",
      )}
    >
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
          className="max-h-48 min-h-[2.75rem] w-full resize-none bg-transparent py-2.5 pl-2 pr-2 text-[0.95rem] leading-relaxed text-foreground outline-none placeholder:text-foreground/35 disabled:opacity-60"
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
      <p className="mt-2 text-center text-[0.7rem] text-foreground/40">
        KI kann sich irren. Kunden, Aufgaben und Termine werden nur geändert, wenn du es so anforderst.
      </p>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background md:min-h-[calc(100dvh-0px)]">
      {!hasMessages ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-8 md:px-8">
          <p className="mb-8 text-center text-2xl font-semibold tracking-tight text-foreground/90 md:text-3xl">
            Womit kann ich helfen?
          </p>
          {composer}
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
                  <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-4 py-3 text-sm text-foreground/50">
                    Denkt nach …
                  </div>
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

function MessageBody({ text, isUser }: { text: string; isUser: boolean }) {
  const lines = text.split("\n");
  return (
    <div className={cn("whitespace-pre-wrap break-words", isUser && "[&_a]:text-white/95")}>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 ? "\n" : null}
        </span>
      ))}
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
