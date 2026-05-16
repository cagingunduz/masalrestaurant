// send-feedback-emails — günde 1 kez (cron ile) çağrılır.
// Rezervasyon tarihinden 24 saat sonra, henüz feedback maili gönderilmemiş
// (status confirmed/arrived, e-posta dolu, feedback_email_sent_at NULL) tüm
// rezervasyonlara Google review + feedback CTA içeren bir e-posta atar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_REVIEW_URL = "https://www.google.com/maps/place/Masal+Restaurant/@51.5605993,5.0737737,546m/data=!3m2!1e3!4b1!4m6!3m5!1s0x47c6be3a619a7935:0x8d002d7c7ca90684!8m2!3d51.5605993!4d5.0763486!16s%2Fg%2F11dfj04mz7?entry=ttu"
const FEEDBACK_FORM_BASE = "https://masalrestaurant.nl/feedback.html"

function fmtDateEU(s: string): string {
  if (!s) return ''
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s)
}

const tpl: Record<string, {
  subject: string
  greeting: (name: string) => string
  intro: (date: string) => string
  about: string
  goodAsk: string
  improveAsk: string
  positive: string
  negative: string
  thanks: string
  welcome: string
  team: string
  header: string
}> = {
  nl: {
    subject: 'Hoe was uw bezoek bij Masal?',
    greeting: (n) => `Beste ${n},`,
    intro: (d) => `We hopen dat u heeft genoten van uw bezoek aan Restaurant Masal${d ? ` op ${d}` : ''}.`,
    about: 'Bij Masal draait alles om sfeer, gastvrijheid en goed eten. We doen er elke dag alles aan om onze gasten een fijne ervaring te geven.',
    goodAsk: 'Was u tevreden en heeft u genoten? Dan zouden we het enorm waarderen als u dat met anderen deelt.',
    improveAsk: 'Is er iets dat beter kon? Laat het ons dan vooral weten, daar leren we van.',
    positive: 'Ja, ik heb genoten',
    negative: 'Ik heb feedback',
    thanks: 'Bedankt dat u de tijd neemt om ons te helpen verbeteren.',
    welcome: 'Hopelijk mogen we u snel weer verwelkomen bij Restaurant Masal.',
    team: 'Team Restaurant Masal',
    header: 'Hoe was uw bezoek?',
  },
  en: {
    subject: 'How was your visit to Masal?',
    greeting: (n) => `Dear ${n},`,
    intro: (d) => `We hope you enjoyed your visit to Restaurant Masal${d ? ` on ${d}` : ''}.`,
    about: 'At Masal, everything revolves around atmosphere, hospitality and great food. Every day we do our utmost to give our guests a wonderful experience.',
    goodAsk: 'Were you happy with your visit? We would really appreciate it if you shared your experience with others.',
    improveAsk: 'Is there anything that could have been better? Please let us know — that\'s how we learn.',
    positive: 'Yes, I enjoyed it',
    negative: 'I have feedback',
    thanks: 'Thank you for taking the time to help us improve.',
    welcome: 'We hope to welcome you back at Restaurant Masal soon.',
    team: 'Team Restaurant Masal',
    header: 'How was your visit?',
  },
  tr: {
    subject: "Masal'daki ziyaretiniz nasıldı?",
    greeting: (n) => `Sayın ${n},`,
    intro: (d) => `${d ? `${d} tarihindeki` : ''} Restaurant Masal ziyaretinizden keyif aldığınızı umuyoruz.`,
    about: 'Masal\'da her şey atmosfer, misafirperverlik ve güzel yemek üzerine kuruludur. Her gün misafirlerimize harika bir deneyim sunmak için elimizden geleni yapıyoruz.',
    goodAsk: 'Memnun kaldıysanız ve keyif aldıysanız, bunu başkalarıyla paylaşırsanız çok memnun oluruz.',
    improveAsk: 'Daha iyi olabilecek bir şey var mıydı? Mutlaka bize bildirin — biz de bundan öğreniyoruz.',
    positive: 'Evet, keyif aldım',
    negative: 'Geri bildirimim var',
    thanks: 'İyileşmemize yardımcı olmak için zaman ayırdığınız için teşekkür ederiz.',
    welcome: 'En kısa zamanda Restaurant Masal\'da tekrar görüşmek üzere.',
    team: 'Restaurant Masal Ekibi',
    header: 'Ziyaretiniz nasıldı?',
  },
}

function escHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function buildHtml(name: string, lang: string, resId: string, visitDate: string) {
  const t = tpl[lang] || tpl.nl
  const safeName = escHtml(name || '')
  const dateStr = fmtDateEU(visitDate)
  const feedbackUrl = `${FEEDBACK_FORM_BASE}?id=${encodeURIComponent(resId)}&lang=${encodeURIComponent(lang)}`
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f7f5f0;font-family:-apple-system,system-ui,sans-serif;color:#333">
  <div style="max-width:560px;margin:0 auto;padding:2rem 1rem">
    <div style="text-align:center;margin-bottom:1.5rem">
      <img src="https://i0.wp.com/masalrestaurant.nl/wp-content/uploads/2021/11/Masal_Logo_DEF.png?fit=600%2C304&ssl=1" width="87" height="44" alt="Masal Restaurant" style="display:block;width:87px;height:44px;margin:0 auto;border:0;outline:none">
    </div>
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e1d8">
      <div style="background:#1e3a1e;padding:1.5rem 2rem;text-align:center">
        <div style="font-size:2rem;margin-bottom:.3rem">&#11088;</div>
        <h2 style="color:#c6a55c;font-family:Georgia,serif;margin:0;font-size:1.3rem;font-weight:500">${t.header}</h2>
      </div>
      <div style="padding:2rem 2rem 1.6rem;color:#333;font-size:.95rem;line-height:1.65">
        <p style="margin:0 0 1.2rem">${t.greeting(safeName)}</p>
        <p style="margin:0 0 1.1rem">${t.intro(dateStr)}</p>
        <p style="margin:0 0 1.1rem">${t.about}</p>
        <p style="margin:0 0 1.6rem">${t.goodAsk}</p>
        <div style="text-align:center;margin:0 0 1.4rem">
          <a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;background:#c6a55c;color:#fff;padding:.95rem 2.4rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem">${t.positive} &#11088;</a>
        </div>
        <p style="margin:0 0 1rem;color:#555">${t.improveAsk}</p>
        <div style="text-align:center;margin:0 0 .5rem">
          <a href="${feedbackUrl}" style="display:inline-block;background:#231f1c;color:#fff;padding:.7rem 1.8rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:.88rem">${t.negative}</a>
        </div>
      </div>
      <div style="background:#fafafa;padding:1.2rem 2rem;border-top:1px solid #efece5;color:#444;font-size:.88rem;line-height:1.6">
        <p style="margin:0 0 .6rem">${t.thanks}</p>
        <p style="margin:0 0 .8rem">${t.welcome}</p>
        <p style="margin:0;font-weight:600;color:#333">${t.team}</p>
      </div>
    </div>
    <p style="text-align:center;color:#aaa;font-size:.72rem;margin-top:1rem">Masal Restaurant &middot; <a href="https://masalrestaurant.nl" style="color:#aaa">masalrestaurant.nl</a></p>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  // Anon key — zaten HTML içinde herkese açık olduğu için sabit kodlu (env var bu projede inject edilmiyor)
  const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15dHF4eGR6ZnJyb3BxY3JoaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjgwMTUsImV4cCI6MjA5MTAwNDAxNX0.eKAts80PGm6TTYSllnYq79UaG0_ERJi7FBLnh2GgG4I'
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } })

  // Cutoff: bugünden 1 gün önce (rezervasyon tarihi <= cutoff olanlar)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // İptal edilmemiş + consent_marketing=true (GDPR — sadece izin verenler) + henüz mail gitmemiş
  const { data: rows, error } = await supa
    .from('reservations')
    .select('id,name,email,date,status,lang')
    .lte('date', cutoffStr)
    .or('status.is.null,status.neq.cancelled')
    .eq('consent_marketing', true)
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
  const errors: unknown[] = []
  for (const r of rows || []) {
    const lang = (r.lang || 'nl').toLowerCase()
    const t = tpl[lang] || tpl.nl
    const html = buildHtml(r.name as string, lang, r.id as string, r.date as string)
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
        body: JSON.stringify({ to: r.email, subject: t.subject, body: '', htmlBody: html }),
      })
      const bodyText = await resp.text().catch(() => '')
      if (resp.ok) {
        await supa.from('reservations')
          .update({ feedback_email_sent_at: new Date().toISOString() })
          .eq('id', r.id)
        sent++
      } else {
        errors.push({ id: r.id, status: resp.status, body: bodyText.slice(0, 500) })
        failed++
      }
    } catch (e) {
      errors.push({ id: r.id, exception: String((e as Error)?.message || e) })
      failed++
    }
  }

  return new Response(JSON.stringify({ processed: (rows || []).length, sent, failed, errors }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
