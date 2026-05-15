-- Feedback / Google review e-mail (24 saat sonra otomatik)
-- - feedback_email_sent_at: e-postanın tekrar atılmasını önlemek için
-- - lang: müşterinin rezervasyon anında seçtiği dil (e-posta o dilde gider)

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS feedback_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS lang text DEFAULT 'nl';

-- public_create_reservation'a p_lang parametresi (default 'nl') eklendi.
-- Önce eski 7-parametreli sürümü kaldır, sonra yeni 8-parametreli sürümü ekle.
DROP FUNCTION IF EXISTS public.public_create_reservation(text,text,text,date,text,text,text);

CREATE OR REPLACE FUNCTION public.public_create_reservation(
  p_name text, p_phone text, p_email text, p_date date,
  p_time text, p_persons text, p_notes text, p_lang text DEFAULT 'nl'
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
  INSERT INTO reservations(name, phone, email, date, time, persons, notes, status, lang)
  VALUES (p_name, p_phone, p_email, p_date, p_time, p_persons, p_notes, 'confirmed',
          coalesce(nullif(trim(p_lang),''),'nl'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_create_reservation(text,text,text,date,text,text,text,text) TO anon, authenticated;
