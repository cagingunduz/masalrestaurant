-- ════════════════════════════════════════════════════════════════════════
-- RLS DÜZELTMESİ
-- site_visits / attendance_events / staff_wages tablolarında RLS açık kaldığı
-- için anon INSERT "42501: new row violates row-level security policy" hatası
-- veriyordu (ziyaret sayacı, personel puantaj ve ücret kaydı çalışmıyordu).
-- Çözüm: RLS açık kalsın ama anon+authenticated için tam-erişim politikası ekle.
-- (Sitenin geri kalanı anon anahtarıyla çalışıyor; bu tablolarda hassas PII yok.)
-- ════════════════════════════════════════════════════════════════════════

-- Ziyaret sayacı (site trafiği)
alter table site_visits enable row level security;
drop policy if exists site_visits_all on site_visits;
create policy site_visits_all on site_visits for all to anon, authenticated using (true) with check (true);
grant insert, select on site_visits to anon, authenticated;

-- Personel puantaj (giriş/çıkış/mola)
alter table attendance_events enable row level security;
drop policy if exists attendance_all on attendance_events;
create policy attendance_all on attendance_events for all to anon, authenticated using (true) with check (true);
grant all on attendance_events to anon, authenticated;

-- Personel saatlik ücreti
alter table staff_wages enable row level security;
drop policy if exists staff_wages_all on staff_wages;
create policy staff_wages_all on staff_wages for all to anon, authenticated using (true) with check (true);
grant all on staff_wages to anon, authenticated;
