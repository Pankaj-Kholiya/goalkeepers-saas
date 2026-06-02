/**
 * Transactional email via Zoho ZeptoMail (server only).
 *
 * ZeptoMail is Zoho's transactional-email product. We call its HTTP API
 * with fetch (no SMTP / nodemailer dependency), keyed on env:
 *
 *   ZEPTOMAIL_TOKEN     the "Send Mail" token (the value AFTER
 *                       "Zoho-enczapikey ")
 *   EMAIL_FROM          a verified sender address on your ZeptoMail domain
 *   EMAIL_FROM_NAME     optional display name (default "GoalKeepers")
 *   ZEPTOMAIL_API_URL   optional; default the global DC. India accounts use
 *                       https://api.zeptomail.in/v1.1/email
 *
 * With the token/from unset, sendEmail returns { ok:false, skipped:true }
 * so callers degrade gracefully (e.g. a created user just doesn't get a
 * welcome mail; the admin still has the temp password). Keys are read at
 * call time, never at import - missing config never breaks the build.
 *
 * Zoho Mail SMTP is the alternative provider; wiring it would need a SMTP
 * client (nodemailer) added to package.json.
 */

const DEFAULT_API_URL = 'https://api.zeptomail.com/v1.1/email'

export interface SendEmailInput {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
}

export type SendEmailResult =
  | { ok: true }
  | { ok: false; error: string; skipped?: boolean }

export function isEmailConfigured(): boolean {
  return Boolean(process.env.ZEPTOMAIL_TOKEN && process.env.EMAIL_FROM)
}

/**
 * Skip obviously non-routable addresses (placeholder student emails like
 * foo@school.local / .test / example.com) so they don't generate bounces.
 * Carried over from Prayaas's deliverability guard.
 */
export function isLikelyDeliverableEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false
  const domain = e.split('@')[1] ?? ''
  if (/\.(local|test|invalid|localhost|example)$/.test(domain)) return false
  if (['example.com', 'example.org', 'example.net'].includes(domain)) {
    return false
  }
  return true
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const token = process.env.ZEPTOMAIL_TOKEN
  const from = process.env.EMAIL_FROM
  if (!token || !from) {
    return { ok: false, error: 'Email is not configured.', skipped: true }
  }
  if (!isLikelyDeliverableEmail(input.to)) {
    return { ok: false, error: 'Non-deliverable address.', skipped: true }
  }
  const url = process.env.ZEPTOMAIL_API_URL ?? DEFAULT_API_URL
  const fromName = process.env.EMAIL_FROM_NAME ?? 'GoalKeepers'

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        // ZeptoMail expects the raw token prefixed with "Zoho-enczapikey".
        Authorization: `Zoho-enczapikey ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from: { address: from, name: fromName },
        to: [
          {
            email_address: {
              address: input.to,
              name: input.toName ?? input.to,
            },
          },
        ],
        subject: input.subject,
        htmlbody: input.html,
        textbody: input.text ?? stripHtml(input.html),
      }),
    })
    if (!res.ok) {
      return { ok: false, error: `Email provider error (${res.status}).` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the email provider.' }
  }
}

/** Crude HTML -> text fallback for the plaintext part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// --------------------------------------------------------------------------
// Templates (brand-light, inline styles - email clients ignore <style>).
// --------------------------------------------------------------------------

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f7f8fb;font-family:Arial,Helvetica,sans-serif;color:#1b1f23">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:bold;color:#1b1f23;margin-bottom:20px">Goal<span style="color:#2FAE46">Keepers</span></div>
    <div style="background:#ffffff;border:1px solid #eef0f4;border-radius:16px;padding:28px">
      <h1 style="margin:0 0 12px;font-size:18px;color:#1b1f23">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="margin:18px 4px 0;font-size:12px;color:#94a3b8">Sent by GoalKeepers. If you weren't expecting this, you can ignore it.</p>
  </div></body></html>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#2FAE46;color:#ffffff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:8px">${label}</a>`
}

export function welcomeEmail(opts: {
  schoolName: string
  loginUrl: string
  email: string
  tempPassword: string
}): { subject: string; html: string } {
  return {
    subject: `Your ${opts.schoolName} account is ready`,
    html: shell(
      `Welcome to ${opts.schoolName}`,
      `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#475569">An account has been created for you on ${opts.schoolName}'s GoalKeepers space. Sign in with the temporary password below and change it after your first login.</p>
       <p style="margin:0 0 6px;font-size:13px;color:#64748b">Email</p>
       <p style="margin:0 0 12px;font-size:14px;font-weight:bold">${opts.email}</p>
       <p style="margin:0 0 6px;font-size:13px;color:#64748b">Temporary password</p>
       <p style="margin:0 0 20px;font-family:monospace;font-size:15px;font-weight:bold">${opts.tempPassword}</p>
       ${button(opts.loginUrl, 'Sign in')}`,
    ),
  }
}

export function campaignEmail(opts: {
  subject: string
  body: string
}): { subject: string; html: string } {
  const safe = opts.body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return {
    subject: opts.subject,
    html: shell(
      opts.subject,
      `<div style="font-size:14px;line-height:1.6;color:#475569">${safe}</div>`,
    ),
  }
}

export function challengeResultEmail(opts: {
  schoolName: string
  correct: number
  total: number
  badgeLabel: string | null
  resultUrl: string
}): { subject: string; html: string } {
  const badgeLine = opts.badgeLabel
    ? `<p style="margin:0 0 14px;font-size:14px;color:#475569">You earned the <strong style="color:#2FAE46">${opts.badgeLabel}</strong> badge.</p>`
    : `<p style="margin:0 0 14px;font-size:14px;color:#475569">Keep going - 2 correct earns your first badge.</p>`
  return {
    subject: `Your weekly challenge result: ${opts.correct}/${opts.total}`,
    html: shell(
      'Weekly challenge complete',
      `<p style="margin:0 0 6px;font-size:13px;color:#64748b">${opts.schoolName}</p>
       <p style="margin:0 0 12px;font-size:28px;font-weight:bold;color:#1b1f23">${opts.correct} / ${opts.total}</p>
       ${badgeLine}
       ${button(opts.resultUrl, 'See the leaderboard')}`,
    ),
  }
}

export function passwordResetEmail(opts: {
  schoolName: string
  resetUrl: string
  minutes: number
}): { subject: string; html: string } {
  return {
    subject: `Reset your ${opts.schoolName} password`,
    html: shell(
      'Reset your password',
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">We received a request to reset your ${opts.schoolName} password. This link expires in ${opts.minutes} minutes. If you didn't ask for it, just ignore this email.</p>
       ${button(opts.resetUrl, 'Choose a new password')}
       <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;word-break:break-all">Or paste this link: ${opts.resetUrl}</p>`,
    ),
  }
}

export function chatbotActivationRequestEmail(opts: {
  schoolName: string
  schoolSlug: string
  adminName: string
  adminEmail: string
  websiteUrl: string | null
  requestedAt: string
  reviewUrl: string
}): { subject: string; html: string } {
  const kv = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:120px;vertical-align:top">${k}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1b1f23">${v}</td></tr>`
  return {
    subject: `New Website AI Chatbot activation request - ${opts.schoolName}`,
    html: shell(
      'Website AI Chatbot activation request',
      `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#475569">A school has requested activation of the Website AI Chatbot. Review the request and provision its chatbot tenant.</p>
       <table style="width:100%;border-collapse:collapse">
         ${kv('School', opts.schoolName)}
         ${kv('School code', opts.schoolSlug)}
         ${kv('Admin', opts.adminName)}
         ${kv('Email', opts.adminEmail)}
         ${kv('Website', opts.websiteUrl ?? '-')}
         ${kv('Requested', opts.requestedAt)}
       </table>
       <div style="margin-top:20px">${button(opts.reviewUrl, 'Review request')}</div>`,
    ),
  }
}
