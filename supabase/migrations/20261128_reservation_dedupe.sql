-- Çift rezervasyon koruması (2026-11-28)
-- Sorun: mail sunucusu yavaş/bozukken onay ekranı gelmiyordu, misafir "rezervasyon yap"a
-- tekrar tekrar bastı ve aynı rezervasyon onlarca kez kaydedildi.
-- Çözüm: aynı e-posta VEYA aynı telefon (son 9 hane) + aynı tarih + aynı saat için
-- son 15 dakikada iptal edilmemiş bir kayıt varsa YENİ KAYIT AÇMA, mevcut id'yi döndür.
-- İmza değişmiyor; sadece gövde güncelleniyor.

CREATE OR REPLACE FUNCTION public.public_create_reservation(
  p_name text, p_phone text, p_email text, p_date date,
  p_time text, p_persons text, p_notes text,
  p_lang text DEFAULT 'nl', p_consent_marketing boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_phone_tail text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 9);
BEGIN
  IF coalesce(trim(p_name),'') = '' OR coalesce(trim(p_phone),'') = ''
     OR coalesce(trim(p_email),'') = '' OR p_date IS NULL
     OR coalesce(trim(p_time),'') = '' THEN
    RAISE EXCEPTION 'missing required reservation fields';
  END IF;

  -- Aynı anda gelen çift tıklamaları sıraya sok (aynı tarih+saat için kilit)
  PERFORM pg_advisory_xact_lock(hashtext('res:' || p_date::text || ':' || trim(p_time)));

  SELECT id INTO v_id FROM reservations
  WHERE date = p_date
    AND left(time::text, 5) = left(trim(p_time), 5)
    AND created_at > now() - interval '15 minutes'
    AND coalesce(status,'') <> 'cancelled'
    AND (lower(trim(email)) = lower(trim(p_email))
         OR (length(v_phone_tail) >= 8
             AND right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 9) = v_phone_tail))
  ORDER BY created_at
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO reservations(name, phone, email, date, time, persons, notes, status, lang, consent_marketing)
  VALUES (p_name, p_phone, p_email, p_date, p_time, p_persons, p_notes, 'new',
          coalesce(nullif(trim(p_lang),''),'nl'),
          coalesce(p_consent_marketing, false))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.public_create_reservation(text,text,text,date,text,text,text,text,boolean) TO anon, authenticated;
