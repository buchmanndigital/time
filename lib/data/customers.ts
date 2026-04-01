import { getSql } from "@/lib/neon";

export type CustomerRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: Date;
};

export async function listCustomersByUserId(userId: string): Promise<CustomerRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, user_id, name, created_at
    FROM customers
    WHERE user_id = ${userId}
    ORDER BY name ASC
  `) as CustomerRow[];
  return rows;
}

export async function findCustomerByIdForUser(
  customerId: string,
  userId: string,
): Promise<CustomerRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, user_id, name, created_at
    FROM customers
    WHERE id = ${customerId} AND user_id = ${userId}
    LIMIT 1
  `) as CustomerRow[];
  return rows[0] ?? null;
}

export async function insertCustomer(
  id: string,
  userId: string,
  name: string,
): Promise<CustomerRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO customers (id, user_id, name)
    VALUES (${id}, ${userId}, ${name})
    RETURNING id, user_id, name, created_at
  `) as CustomerRow[];
  const row = rows[0];
  if (!row) throw new Error("INSERT customers lieferte keine Zeile.");
  return row;
}

export async function updateCustomerForUser(
  customerId: string,
  userId: string,
  name: string,
): Promise<CustomerRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const sql = getSql();
  const rows = (await sql`
    UPDATE customers
    SET name = ${trimmed}
    WHERE id = ${customerId} AND user_id = ${userId}
    RETURNING id, user_id, name, created_at
  `) as CustomerRow[];
  return rows[0] ?? null;
}

export async function deleteCustomerForUser(customerId: string, userId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM customers
    WHERE id = ${customerId} AND user_id = ${userId}
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}
