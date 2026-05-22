-- Genel uygulama ayarları (key/value). Şimdilik vardiya renkleri için.
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text
);
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON app_settings TO anon, authenticated;

-- Varsayılanlar: sabahçı (<=17:00) açık yeşil; akşamcı boş = personel rengi
INSERT INTO app_settings(key, value) VALUES
  ('shift_color_morning', '#d8f5d3'),
  ('shift_color_evening', '')
ON CONFLICT (key) DO NOTHING;
