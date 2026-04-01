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
