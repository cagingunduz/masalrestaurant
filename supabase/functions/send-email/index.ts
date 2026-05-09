import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
  const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'manager@masalrestaurant.nl'
  const FROM_EMAIL = 'MasalShift <onboarding@resend.dev>'
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { to, userId, subject, body } = await req.json()

  let toEmail: string

  // If userId provided, look up fresh contact_email from profiles table
  if (userId) {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: profile } = await supa.from('profiles').select('contact_email').eq('id', userId).single()
    if (!profile?.contact_email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no contact_email for user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    toEmail = profile.contact_email
  } else if (to === 'admin') {
    toEmail = ADMIN_EMAIL
  } else if (typeof to === 'string') {
    toEmail = to
  } else if (to?.contact_email) {
    toEmail = to.contact_email
  } else {
    return new Response(JSON.stringify({ error: 'Invalid recipient' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Skip internal fake emails
  if (toEmail.includes('@masalstaff.internal') || toEmail.includes('@masalshift.internal')) {
    return new Response(JSON.stringify({ skipped: true, reason: 'internal email' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [toEmail],
      subject,
      text: body,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <img src="https://i0.wp.com/masalrestaurant.nl/wp-content/uploads/2021/11/Masal_Logo_DEF.png?fit=600%2C304&ssl=1" style="height:40px;margin-bottom:1.5rem;filter:sepia(1)saturate(2)hue-rotate(5deg)">
        <div style="background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #e5e1d8;white-space:pre-line">${body.replace(/\n/g,'<br>')}</div>
        <p style="color:#aaa;font-size:.75rem;margin-top:1rem">MasalShift — <a href="https://masalrestaurant.nl/staff">masalrestaurant.nl/staff</a></p>
      </div>`
    })
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    status: res.ok ? 200 : 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
