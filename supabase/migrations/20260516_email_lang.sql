-- Add email_lang preference to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_lang text DEFAULT 'nl';
