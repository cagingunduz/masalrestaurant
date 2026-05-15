// send-feedback-emails — günde 1 kez (cron ile) çağrılır.
// Rezervasyon tarihinden 24 saat sonra, henüz feedback maili gönderilmemiş
// (status confirmed/arrived, e-posta dolu, feedback_email_sent_at NULL) tüm
// rezervasyonlara Google review + feedback CTA içeren bir e-posta atar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_REVIEW_URL = 'https://www.google.com/maps/place/Masal+Restaurant/@51.5605993,5.0763486,17z/data=!3m1!4b1!4m8!3m7!1s0x47c6be3a619a7935:0x8d002d7c7ca90684!8m2!3d51.5605993!4d5.0763486!9m1!1b1'
const FEEDBACK_EMAIL = 'info@masalrestaurant.nl'

const tpl: Record<string, {
  subject: string
  greeting: (name: string) => string
  body: string
  question: string
  positive: string
  negative: string
  closing: string
  team: string
}> = {
  nl: {
    subject: 'Hoe was uw bezoek bij Masal?',
    greeting: (n) => `Beste ${n},`,
    body: 'Wij hopen dat u genoten heeft van uw bezoek aan Masal Restaurant & Café. Uw mening is voor ons heel belangrijk!',
    question: 'Hoe was uw ervaring?',
    positive: 'Laat een review achter op Google',
    negative: 'Iets niet naar wens? Laat het ons weten',
    closing: 'Bedankt en tot ziens!',
    team: 'Het team van Masal Restaurant & Café',
  },
  en: {
    subject: 'How was your visit to Masal?',
    greeting: (n) => `Dear ${n},`,
    body: 'We hope you enjoyed your visit to Masal Restaurant & Café. Your opinion means a lot to us!',
    question: 'How was your experience?',
    positive: 'Leave a Google review',
    negative: 'Something not right? Let us know',
    closing: 'Thank you, and see you next time!',
    team: 'The Masal Restaurant & Café team',
  },
  tr: {
    subject: "Masal'daki ziyaretiniz nasıldı?",
    greeting: (n) => `Sayın ${n},`,
    body: "Masal Restaurant & Café'deki ziyaretinizden keyif aldığınızı umuyoruz. Görüşünüz bizim için çok değerli!",
    question: 'Deneyiminiz nasıldı?',
    positive: "Google'da yorum bırakın",
    negative: 'Bir aksaklık mı oldu? Bize bildirin',
    closing: 'Teşekkürler, tekrar görüşmek üzere!',
    team: 'Masal Restaurant & Café ekibi',
  },
}

function escHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function buildHtml(name: string, lang: string) {
  const t = tpl[lang] || tpl.nl
  const safeName = escHtml(name || '')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f7f5f0;font-family:-apple-system,system-ui,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:2rem 1rem">
    <div style="text-align:center;margin-bottom:1.5rem">
      <img src="https://i0.wp.com/masalrestaurant.nl/wp-content/uploads/2021/11/Masal_Logo_DEF.png?fit=600%2C304&ssl=1" width="87" height="44" alt="Masal Restaurant" style="display:block;width:87px;height:44px;margin:0 auto;border:0;outline:none">
    </div>
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e1d8">
      <div style="background:#1e3a1e;padding:1.5rem 2rem;text-align:center">
        <div style="font-size:2.2rem">⭐</div>
        <h2 style="color:#c6a55c;font-family:Georgia,serif;margin:.4rem 0 0;font-size:1.25rem">${t.question}</h2>
      </div>
      <div style="padding:1.8rem 2rem">
        <p style="color:#444;margin:0 0 .8rem">${t.greeting(safeName)}</p>
        <p style="color:#555;font-size:.95rem;line-height:1.6;margin:0 0 1.6rem">${t.body}</p>
        <div style="text-align:center;margin-bottom:1.1rem">
          <a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;background:#c6a55c;color:#111;padding:.85rem 2rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:.95rem">⭐ ${t.positive}</a>
        </div>
        <div style="text-align:center">
          <a href="mailto:${FEEDBACK_EMAIL}?subject=Feedback%20Masal" style="display:inline-block;color:#888;text-decoration:underline;font-size:.85rem">${t.negative}</a>
        </div>
      </div>
      <div style="background:#f7f5f0;padding:1rem 2rem;border-top:1px solid #e5e1d8;text-align:center">
        <p style="margin:0;color:#555;font-size:.82rem">${t.closing}<br><strong>${t.team}</strong></p>
      </div>
    </div>
    <p style="text-align:center;color:#aaa;font-size:.72rem;margin-top:1rem">Masal Restaurant & Café · <a href="https://masalrestaurant.nl" style="color:#aaa">masalrestaurant.nl</a></p>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } })

  // Cutoff: bugünden 1 gün önce (rezervasyon tarihi <= cutoff olanlar)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // İptal edilmemiş tüm rezervasyonlar (new / confirmed / arrived dahil; cancelled hariç)
  const { data: rows, error } = await supa
    .from('reservations')
    .select('id,name,email,date,status,lang')
    .lte('date', cutoffStr)
    .or('status.is.null,status.neq.cancelled')
    .not('email', 'is', null)
    .neq('email', '')
    .is('feedback_email_sent_at', null)
    .limit(200)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0, failed = 0
  for (const r of rows || []) {
    const lang = (r.lang || 'nl').toLowerCase()
    const t = tpl[lang] || tpl.nl
    const html = buildHtml(r.name as string, lang)
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({ to: r.email, subject: t.subject, body: '', htmlBody: html }),
      })
      if (resp.ok) {
        await supa.from('reservations')
          .update({ feedback_email_sent_at: new Date().toISOString() })
          .eq('id', r.id)
        sent++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return new Response(JSON.stringify({ processed: (rows || []).length, sent, failed }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
