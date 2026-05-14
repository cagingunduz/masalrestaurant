-- Fix availability table: disable RLS (staff uses password auth, not Supabase auth)
ALTER TABLE availability DISABLE ROW LEVEL SECURITY;
