"use client";

import { useEffect, useState } from "react";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { cn } from "@/lib/utils/cn";

export function AuthenticatedAppShell({
  userEmail,
  children,
}: {
  userEmail: string;
  /** Hauptinhalt (z. B. leere Startseite oder Board) */
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden md:flex-row">
      <header className="flex shrink-0 items-center justify-between border-b border-foreground/10 px-4 py-3 md:hidden">
        <span className="text-sm font-semibold tracking-[0.2em] text-foreground">TIME</span>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-foreground/15 text-foreground hover:bg-foreground/5"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          aria-label="Menü öffnen"
        >
          <MenuIcon />
        </button>
      </header>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Menü schließen"
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(100%,20rem)] flex-col border-foreground/10 bg-background transition-transform duration-200 ease-out md:static md:z-0 md:w-80 md:shrink-0 md:border-r md:transition-none",
          menuOpen ? "translate-x-0 shadow-2xl md:shadow-none" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3 md:hidden">
          <span className="truncate text-xs text-foreground/60">{userEmail}</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-foreground/5"
            aria-label="Menü schließen"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="hidden border-b border-foreground/10 px-4 py-4 md:block">
          <p className="text-xs text-foreground/45">Angemeldet als</p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">{userEmail}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <AppSidebarNav onNavigate={() => setMenuOpen(false)} />
        </div>
      </aside>

      <main
        className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden bg-background md:min-h-screen"
        aria-label="Arbeitsbereich"
      >
        {children}
      </main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
