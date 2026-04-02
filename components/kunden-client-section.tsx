"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CustomerDetailModal,
  CustomerListRow,
  type CustomerListItemDto,
} from "@/components/customer-detail-modal";

type Props = {
  initialCustomers: CustomerListItemDto[];
};

export function KundenClientSection({ initialCustomers }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [detail, setDetail] = useState<CustomerListItemDto | null>(null);

  useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  const sorted = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [customers],
  );

  return (
    <>
      {sorted.length === 0 ? (
        <p className="text-sm text-foreground/50">Noch keine Kunden angelegt.</p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-foreground/10">
          {sorted.map((c) => (
            <CustomerListRow key={c.id} customer={c} onSelect={setDetail} />
          ))}
        </ul>
      )}

      <CustomerDetailModal
        customer={detail}
        open={detail !== null}
        onClose={() => setDetail(null)}
        onSaved={(customerId, patch) => {
          setCustomers((prev) =>
            prev.map((x) => (x.id === customerId ? { ...x, name: patch.name } : x)),
          );
          router.refresh();
        }}
        onDeleted={(customerId) => {
          setCustomers((prev) => prev.filter((x) => x.id !== customerId));
          router.refresh();
        }}
      />
    </>
  );
}
