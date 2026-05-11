-- Rebuild shift_notifications to track per shift instead of per week
DROP TABLE IF EXISTS shift_notifications;

CREATE TABLE shift_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  sent_at timestamptz DEFAULT now(),
  UNIQUE(shift_id, staff_id)
);
