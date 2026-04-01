ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_customer_id ON tasks (customer_id);
