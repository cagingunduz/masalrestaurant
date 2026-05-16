-- Geri bildirim sistemi + parti formu düzeltmeleri + GDPR onayı
-- Bu migration:
--  1) reservations'a consent_marketing kolonu (GDPR — feedback maili için izin)
--  2) party_requests.event_date'i opsiyonel hâle getirir (müşteri seçmiyor artık)
--  3) feedback_submissions tablosunu oluşturur (admin panelde gösterilecek)
--  4) public_create_reservation'ı günceller: status='new' default + consent param
--  5) public_create_party_request'i günceller: event_date kaldırıldı, guests güvenli cast
--  6) submit_feedback RPC'si

-- 1) GDPR pazarlama onayı
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS consent_marketing boolean DEFAULT false;

-- 2) Parti talebinde tarih opsiyonel
ALTER TABLE party_requests ALTER COLUMN event_date DROP NOT NULL;

-- 3) Geri bildirim mesajları tablosu
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  name text,
  email text,
  rating int CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  categories text[],
  message text NOT NULL,
  lang text DEFAULT 'nl',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_submissions_created_idx ON feedback_submissions (created_at DESC);
ALTER TABLE feedback_submissions DISABLE ROW LEVEL SECURITY;

-- 4) public_create_reservation — status default 'new', consent eklendi
DROP FUNCTION IF EXISTS public.public_create_reservation(text,text,text,date,text,text,text,text);

CREATE OR REPLACE FUNCTION public.public_create_reservation(
  p_name text, p_phone text, p_email text, p_date date,
  p_time text, p_persons text, p_notes text,
  p_lang text DEFAULT 'nl', p_consent_marketing boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(trim(p_name),'') = '' OR coalesce(trim(p_phone),'') = ''
     OR coalesce(trim(p_email),'') = '' OR p_date IS NULL
     OR coalesce(trim(p_time),'') = '' THEN
    RAISE EXCEPTION 'missing required reservation fields';
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

-- 5) public_create_party_request — event_date kaldırıldı, guests güvenli cast
DROP FUNCTION IF EXISTS public.public_create_party_request(text,text,text,text,date,text,text,text,text);

CREATE OR REPLACE FUNCTION public.public_create_party_request(
  p_name text, p_phone text, p_email text, p_guests text,
  p_event_type text, p_decoration text, p_cake text, p_wishes text,
  p_lang text DEFAULT 'nl'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_guests int;
BEGIN
  IF coalesce(trim(p_name),'') = '' OR coalesce(trim(p_phone),'') = ''
     OR coalesce(trim(p_email),'') = '' THEN
    RAISE EXCEPTION 'missing required party request fields';
  END IF;
  v_guests := CASE WHEN p_guests ~ '^[0-9]+$' THEN p_guests::int ELSE NULL END;
  INSERT INTO party_requests(name, phone, email, guests, event_type, decoration, cake, wishes)
  VALUES (p_name, p_phone, p_email, v_guests, p_event_type, p_decoration, p_cake, p_wishes)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.public_create_party_request(text,text,text,text,text,text,text,text,text) TO anon, authenticated;

-- 6) submit_feedback — feedback formundan gelen mesajları kaydeder
CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_reservation_id uuid, p_name text, p_email text,
  p_rating int, p_categories text[], p_message text,
  p_lang text DEFAULT 'nl'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(trim(p_message),'') = '' THEN
    RAISE EXCEPTION 'feedback message is required';
  END IF;
  INSERT INTO feedback_submissions(reservation_id, name, email, rating, categories, message, lang)
  VALUES (p_reservation_id, p_name, p_email, p_rating, p_categories, p_message,
          coalesce(nullif(trim(p_lang),''),'nl'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_feedback(uuid,text,text,int,text[],text,text) TO anon, authenticated;
