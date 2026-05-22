-- Full-time vardiya rengi (sabah başlayıp akşam kapanışa kadar çalışanlar)
INSERT INTO app_settings(key, value) VALUES ('shift_color_full', '#cfe3f5')
ON CONFLICT (key) DO NOTHING;
