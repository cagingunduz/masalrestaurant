-- Track who cancelled a reservation: 'customer' (via cancel-link in e-mail) of 'admin'.
-- Hiermee kan het display-systeem klant-annuleringen apart tonen.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS cancelled_by text;
