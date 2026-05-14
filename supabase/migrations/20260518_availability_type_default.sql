-- type column has no default, causing inserts to fail silently
ALTER TABLE availability ALTER COLUMN type SET DEFAULT 'availability';
