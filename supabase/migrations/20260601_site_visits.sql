-- Basit, birinci-taraf site trafiği sayacı.
-- Her sayfa görüntülemesinde 1 satır eklenir. visitor_id = cihazda localStorage'da
-- tutulan rastgele kimlik (KİŞİSEL VERİ DEĞİL — IP/ad/e-posta saklanmaz).
-- Admin panelindeki İstatistik sekmesi bu tablodan günlük/haftalık ziyaretçi hesaplar.

CREATE TABLE IF NOT EXISTS site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text,
  path text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

-- Sitenin geri kalanı gibi anon erişimli (RLS kapalı)
ALTER TABLE site_visits DISABLE ROW LEVEL SECURITY;

-- anon: sayfadan kayıt ekleyebilsin (INSERT) + admin okuyabilsin (SELECT)
GRANT INSERT, SELECT ON site_visits TO anon, authenticated;

-- Tarihe göre sorgular için indeks
CREATE INDEX IF NOT EXISTS site_visits_created_idx ON site_visits(created_at);
