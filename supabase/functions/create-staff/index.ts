import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { name, password, color, department } = await req.json()

  if (!name || !password) {
    return new Response(JSON.stringify({ error: 'name and password are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Auto-generate internal email — not shown to anyone
  const slug = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
  const rand = Math.random().toString(36).slice(2, 6)
  const email = `${slug}.${rand}@masalstaff.internal`

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const id = authData.user.id
  const words = name.trim().split(/\s+/)
  const initials = words.map((w: string) => w[0]).join('').toUpperCase().slice(0, 3)

  // Insert into profiles with auth user's id
  const { data: profile, error: profileError } = await supabase.from('profiles').insert({
    id, name, initials, email, password, color: color || '#c6a55c', role: 'staff', department: department || null
  }).select().single()

  if (profileError) {
    // Rollback: delete auth user
    await supabase.auth.admin.deleteUser(id)
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify(profile), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
