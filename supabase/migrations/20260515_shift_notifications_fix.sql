-- Rebuild without FK constraints to avoid reference issues
DROP TABLE IF EXISTS shift_notifications;

CREATE TABLE shift_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  week_start date NOT NULL,
  sent_at timestamptz DEFAULT now(),
  UNIQUE(shift_id, staff_id)
);

ALTER TABLE shift_notifications DISABLE ROW LEVEL SECURITY;
