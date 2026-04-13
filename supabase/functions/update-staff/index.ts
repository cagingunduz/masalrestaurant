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

  const { userId, password, department, color } = await req.json()

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Update Auth password if provided — skip silently if no Auth account exists yet
  if (password) {
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, { password })
    if (authError && !authError.message.includes('User not found')) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Build profile update object
  const updates: Record<string, unknown> = {}
  if (department !== undefined) updates.department = department
  if (color) updates.color = color
  if (password) updates.password = password

  if (Object.keys(updates).length > 0) {
    const { error: profileError } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
