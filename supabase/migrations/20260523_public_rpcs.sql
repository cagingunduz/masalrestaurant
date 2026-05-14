-- ============================================================================
-- RLS hardening — Stage 1: public RPC functions (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
-- The anonymous client (reserveren.html / cancel.html / confirm.html / index.html)
-- currently reads & writes the `reservations`, `party_requests` and
-- `capacity_limits` tables directly with the public anon key. These functions
-- replace that direct access so that, once RLS is enabled in Stage 3, the
-- anonymous role needs NO direct table access at all.
--
-- This migration is ADDITIVE and SAFE: it only creates functions. Nothing
-- breaks if it is run while RLS is still disabled.
-- ============================================================================

-- Make sure the columns/tables these functions rely on exist (idempotent).
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_by text;

CREATE TABLE IF NOT EXISTS capacity_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_persons int NOT NULL CHECK (max_persons > 0),
  note text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capacity_limits_date_idx ON capacity_limits (date);

-- ----------------------------------------------------------------------------
-- 1. Day availability for the booking page.
--    Returns capacity limits + aggregate booked counts ONLY — no customer PII.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_get_day_availability(p_date date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'start_time',  cl.start_time,
    'end_time',    cl.end_time,
    'max_persons', cl.max_persons,
    'booked', (
      SELECT COALESCE(SUM(
        CASE WHEN r.persons ~ '^[0-9]+$' THEN r.persons::int ELSE 0 END
      ), 0)
      FROM reservations r
      WHERE r.date = p_date
        AND r.status IS DISTINCT FROM 'cancelled'
        AND r.time ~ '^[0-9]{1,2}:[0-9]{2}'
        AND r.time::time >= cl.start_time
        AND r.time::time <  cl.end_time
    )
  )), '[]'::jsonb)
  INTO v_result
  FROM capacity_limits cl
  WHERE cl.date = p_date;
  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Create a reservation (auto-confirmed, like the current website flow).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_create_reservation(
  p_name text, p_phone text, p_email text, p_date date,
  p_time text, p_persons text, p_notes text
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
  INSERT INTO reservations(name, phone, email, date, time, persons, notes, status)
  VALUES (p_name, p_phone, p_email, p_date, p_time, p_persons, p_notes, 'confirmed')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Create a party / event request.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_create_party_request(
  p_name text, p_phone text, p_email text, p_guests text,
  p_event_date date, p_event_type text, p_decoration text,
  p_cake text, p_wishes text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(trim(p_name),'') = '' OR coalesce(trim(p_phone),'') = ''
     OR coalesce(trim(p_email),'') = '' OR p_event_date IS NULL THEN
    RAISE EXCEPTION 'missing required party request fields';
  END IF;
  INSERT INTO party_requests(name, phone, email, guests, event_date,
                             event_type, decoration, cake, wishes)
  VALUES (p_name, p_phone, p_email, p_guests, p_event_date,
          p_event_type, p_decoration, p_cake, p_wishes)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Fetch one reservation by id (capability-based: the id is an unguessable
--    uuid the customer received by e-mail). Returns minimal fields only.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_get_reservation(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row jsonb;
BEGIN
  SELECT jsonb_build_object('name', name, 'date', date, 'time', time, 'status', status)
  INTO v_row FROM reservations WHERE id = p_id;
  RETURN v_row;  -- NULL when not found
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Cancel a reservation by id. Returns: 'ok' | 'already' | 'not_found'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_cancel_reservation(p_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM reservations WHERE id = p_id;
  IF v_status IS NULL THEN RETURN 'not_found'; END IF;
  IF v_status = 'cancelled' THEN RETURN 'already'; END IF;
  UPDATE reservations SET status = 'cancelled', cancelled_by = 'customer'
  WHERE id = p_id;
  RETURN 'ok';
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Confirm a reservation by id. Returns: 'ok' | 'already' | 'cancelled' | 'not_found'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_confirm_reservation(p_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM reservations WHERE id = p_id;
  IF v_status IS NULL THEN RETURN 'not_found'; END IF;
  IF v_status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF v_status = 'confirmed' THEN RETURN 'already'; END IF;
  UPDATE reservations SET status = 'confirmed' WHERE id = p_id;
  RETURN 'ok';
END;
$$;

-- ----------------------------------------------------------------------------
-- Grant execute to the anonymous + authenticated roles.
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.public_get_day_availability(date)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_create_reservation(text,text,text,date,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_create_party_request(text,text,text,text,date,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_reservation(uuid)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_cancel_reservation(uuid)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_confirm_reservation(uuid)          TO anon, authenticated;
