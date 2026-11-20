import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Personele bağlı kayıtlar: profiles silinmeden önce temizlenmeli,
// yoksa FK kısıtı yüzünden profile silinemez (eski sürüm bu hatayı yutuyordu).
// (attendance_events / staff_wages profiles'a ON DELETE CASCADE ile bağlı.)
// Tablo/kolon bu projede yoksa hata yok sayılır.
const DEPENDENTS: [string, string][] = [
  ['shift_assignments', 'staff_id'],
  ['shift_notifications', 'staff_id'],
  ['availability', 'staff_id'],
  ['swap_requests', 'requester_id'],
  ['swap_requests', 'target_id'],
]

const isMissingRelation = (msg = '') =>
  /does not exist|could not find|schema cache/i.test(msg)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { userId } = await req.json().catch(() => ({}))
  if (!userId) return json({ error: 'userId is required' }, 400)

  for (const [table, col] of DEPENDENTS) {
    const { error } = await supabase.from(table).delete().eq(col, userId)
    if (error && !isMissingRelation(error.message)) {
      return json({ error: `${table}: ${error.message}` }, 400)
    }
  }

  const { error: profErr } = await supabase.from('profiles').delete().eq('id', userId)
  if (profErr) return json({ error: `profiles: ${profErr.message}` }, 400)

  // Auth user — legacy personelin Auth hesabı olmayabilir
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error && !/not found/i.test(error.message)) {
    return json({ error: `auth: ${error.message}` }, 400)
  }

  return json({ success: true })
})
