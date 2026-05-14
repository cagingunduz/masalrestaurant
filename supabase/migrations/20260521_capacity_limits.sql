-- Capacity limits: admin kan per datum + tijdsbereik een max. aantal personen instellen.
-- Wanneer het aantal geboekte personen binnen dat bereik de limiet bereikt,
-- worden de bijbehorende tijdsloten in het reserveringsformulier uitgeschakeld.

CREATE TABLE IF NOT EXISTS capacity_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_persons int NOT NULL CHECK (max_persons > 0),
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capacity_limits_date_idx ON capacity_limits (date);

ALTER TABLE capacity_limits DISABLE ROW LEVEL SECURITY;
