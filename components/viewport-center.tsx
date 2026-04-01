export function ViewportCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      {children}
    </div>
  );
}
