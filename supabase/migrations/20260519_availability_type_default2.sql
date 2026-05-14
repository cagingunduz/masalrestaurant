-- Fix default to a valid value per the check constraint
ALTER TABLE availability ALTER COLUMN type SET DEFAULT 'allday';
