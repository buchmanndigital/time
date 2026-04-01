-- Optional: potenzieller Umsatz / erwarteter Betrag pro Aufgabe (Euro, zwei Nachkommastellen)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS potential_amount_eur NUMERIC(12, 2);
