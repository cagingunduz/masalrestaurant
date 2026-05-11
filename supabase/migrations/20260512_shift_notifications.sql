create table if not exists shift_notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  sent_at timestamptz default now(),
  unique(staff_id, week_start)
);
