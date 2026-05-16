-- party_requests tablosuna da GDPR pazarlama onayı (rezervasyonla aynı yapı)

ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS consent_marketing boolean DEFAULT false;

-- public_create_party_request RPC'sini güncelle: p_consent_marketing eklendi (default true — varsayılan işaretli)
DROP FUNCTION IF EXISTS public.public_create_party_request(text,text,text,text,date,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.public_create_party_request(
  p_name text, p_phone text, p_email text, p_guests text,
  p_event_date date, p_event_time text,
  p_event_type text, p_decoration text, p_cake text, p_wishes text,
  p_lang text DEFAULT 'nl', p_consent_marketing boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_guests int;
  v_time time;
BEGIN
  IF coalesce(trim(p_name),'') = '' OR coalesce(trim(p_phone),'') = ''
     OR coalesce(trim(p_email),'') = '' THEN
    RAISE EXCEPTION 'missing required party request fields';
  END IF;
  v_guests := CASE WHEN p_guests ~ '^[0-9]+$' THEN p_guests::int ELSE NULL END;
  v_time := CASE WHEN p_event_time ~ '^[0-9]{1,2}:[0-9]{2}' THEN p_event_time::time ELSE NULL END;
  INSERT INTO party_requests(name, phone, email, guests, event_date, event_time, event_type, decoration, cake, wishes, consent_marketing)
  VALUES (p_name, p_phone, p_email, v_guests, p_event_date, v_time, p_event_type, p_decoration, p_cake, p_wishes,
          coalesce(p_consent_marketing, true))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.public_create_party_request(text,text,text,text,date,text,text,text,text,text,text,boolean) TO anon, authenticated;
