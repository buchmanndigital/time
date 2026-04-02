"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutForm } from "@/components/forms/logout-form";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/", label: "Start" },
  { href: "/board", label: "Board" },
  { href: "/kalender", label: "Kalender" },
  { href: "/kunden", label: "Kunden" },
  { href: "/einstellungen", label: "Einstellungen" },
] as const;

export function AppSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-8">
      <nav className="flex flex-col gap-0.5" aria-label="Hauptnavigation">
        {LINKS.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-foreground/10 pt-4">
        <LogoutForm />
      </div>
    </div>
  );
}
