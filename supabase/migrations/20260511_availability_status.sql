-- Add status and unavailable_ranges columns to availability table
ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS unavailable_ranges jsonb DEFAULT '[]';
