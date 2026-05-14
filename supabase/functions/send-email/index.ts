import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @deno-types="npm:@types/nodemailer"
import nodemailer from 'npm:nodemailer'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SMTP_HOST    = Deno.env.get('SMTP_HOST')    || 'mail.masalrestaurant.nl'
  const SMTP_PORT    = parseInt(Deno.env.get('SMTP_PORT') || '587')
  const SMTP_USER    = Deno.env.get('SMTP_USER')    || 'reserveren@masalrestaurant.nl'
  const SMTP_PASS    = Deno.env.get('SMTP_PASS')    || ''
  const ADMIN_EMAIL  = Deno.env.get('ADMIN_EMAIL')  || 'manager@masalrestaurant.nl'
  const FROM_EMAIL   = SMTP_USER
  const FROM_NAME    = 'Masal Restaurant & Café'
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  const { to, userId, subject, body, htmlBody: customHtml } = await req.json()

  // Resolve recipient
  let toEmail: string
  if (userId) {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: profile } = await supa.from('profiles').select('contact_email').eq('id', userId).single()
    if (!profile?.contact_email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no contact_email' }), {
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

  // HTML fallback wrapper (used for staff shift emails)
  const htmlBody = customHtml ?? `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
    <img src="https://i0.wp.com/masalrestaurant.nl/wp-content/uploads/2021/11/Masal_Logo_DEF.png?fit=600%2C304&ssl=1" style="height:40px;margin-bottom:1.5rem">
    <div style="background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #e5e1d8;white-space:pre-line">${(body||'').replace(/\n/g,'<br>')}</div>
    <p style="color:#aaa;font-size:.75rem;margin-top:1rem">Masal Restaurant & Café · <a href="https://masalrestaurant.nl">masalrestaurant.nl</a></p>
  </div>`

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
  })

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: toEmail,
      subject,
      text: body || '',
      html: htmlBody,
    })
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
