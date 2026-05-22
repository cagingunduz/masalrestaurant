-- app_settings: cihazlar arası ortak vardiya renkleri için RLS/grant kesin düzeltmesi.
-- Belirti: tablo var ama anon ne okuyabiliyor ne yazabiliyor (RLS açık + policy yok).
-- Bu yüzden renkler sadece localStorage'da kalıyor → telefon/PC farklı görünüyor.

-- 1) Tablo yoksa oluştur
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text
);

-- 2) RLS'i kapat (sitenin geri kalanı gibi anon erişimli)
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- 3) anon + authenticated rollerine tam erişim ver
GRANT ALL ON app_settings TO anon, authenticated;

-- 4) Varsayılan renkleri ekle (zaten varsa dokunma)
INSERT INTO app_settings(key, value) VALUES
  ('shift_color_morning', '#d8f5d3'),
  ('shift_color_evening', ''),
  ('shift_color_full',    '#cfe3f5')
ON CONFLICT (key) DO NOTHING;
