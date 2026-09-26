-- ════════════════════════════════════════════════════════════════════════
-- Personeel puantaj (giriş/çıkış + mola) + saatlik ücret
-- Personel Supabase Auth değil, profiles.password ile giriş yapıyor; bu yüzden
-- bu tablolarda da (availability gibi) RLS kapalı, erişim anon anahtarıyla.
-- ════════════════════════════════════════════════════════════════════════

-- Puantaj olay günlüğü: her tıklama bir satır (giriş / mola başı / mola sonu / çıkış)
create table if not exists attendance_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('clock_in','break_start','break_end','clock_out')),
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_attendance_profile_at on attendance_events (profile_id, at);
create index if not exists idx_attendance_at on attendance_events (at desc);

alter table attendance_events disable row level security;
grant all on attendance_events to anon, authenticated;

-- Personel saatlik ücreti (admin doldurur). profiles'ı değiştirmemek için ayrı tablo.
create table if not exists staff_wages (
  profile_id uuid primary key references profiles(id) on delete cascade,
  hourly_wage numeric(6,2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table staff_wages disable row level security;
grant all on staff_wages to anon, authenticated;
