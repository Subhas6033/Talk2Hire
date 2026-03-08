const crypto = require("crypto");
const {
  asyncHandler,
  APIERR,
  APIRES,
  sendMail,
} = require("../Utils/index.utils.js");
const { pool } = require("../Config/database.config.js");
const db = pool;

/* ─────────────────────────────────────────────
   Helper: build job alert HTML email
───────────────────────────────────────────── */
const buildJobAlertHTML = (job, unsubscribeToken) => {
  const appUrl = process.env.CORS_ORIGIN || "https://talk2hire.com";
  const year = new Date().getFullYear(); // ✅ FIX 1

  // ✅ FIX 2 — shortDesc defined before template string uses it
  const shortDesc = job.description
    ? job.description.length > 180
      ? job.description.substring(0, job.description.lastIndexOf(" ", 180)) +
        "…"
      : job.description
    : null;

  // ✅ FIX 3 — skillsHTML defined before template string uses it
  const skillsHTML =
    Array.isArray(job.skills) && job.skills.length > 0
      ? `<div style="margin-bottom:32px;">
          <p style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#C4B8A8;margin:0 0 10px;">Skills &amp; Technologies</p>
          ${job.skills
            .map(
              (s) =>
                `<span style="display:inline-block;background:#F5F4F1;border:1px solid #E8E5E0;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:500;color:#374151;margin:0 6px 6px 0;">${s}</span>`,
            )
            .join("")}
         </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>New Job Alert — ${job.title} at ${job.company}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');

    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body, table, td, th { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { border: 0; display: block; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }

    body {
      background: #EDEAE4;
      font-family: 'DM Sans', Arial, sans-serif;
    }

    /* ── Utility ── */
    .wordmark {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-weight: 900;
      color: #0d0d12;
      letter-spacing: -0.4px;
      text-decoration: none;
    }
    .wordmark-accent { color: #d97706; }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      border-radius: 100px;
      padding: 5px 12px 5px 10px;
      font-size: 11px;
      font-weight: 700;
      color: #92400E;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .chip-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #d97706;
      display: inline-block;
      flex-shrink: 0;
    }

    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #d97706;
      margin: 0 0 12px;
    }
    .h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36px;
      font-weight: 900;
      color: #0d0d12;
      line-height: 1.15;
      letter-spacing: -0.8px;
      margin: 0 0 14px;
    }
    .h1 em { font-style: italic; color: #374151; }

    .subtext {
      font-size: 15px;
      color: #6B7280;
      line-height: 1.65;
      max-width: 440px;
      margin: 0;
    }

    /* ── Job strip ── */
    .job-strip {
      background: #FAFAF9;
      border-top: 1.5px solid #F0EDE8;
      padding: 20px 48px;
    }
    .strip-company {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #d97706;
      margin: 0 0 3px;
    }
    .strip-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      font-weight: 700;
      color: #0d0d12;
      letter-spacing: -0.2px;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .strip-meta {
      font-size: 12px;
      color: #9CA3AF;
      font-weight: 500;
      margin: 0 0 4px;
    }
    .strip-meta:last-child { margin-bottom: 0; }
    .strip-meta strong { color: #4B5563; font-weight: 600; }

    /* ── Role card ── */
    .role-card {
      background: #FAFAF9;
      border: 1.5px solid #F0EDE8;
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 28px;
    }
    .card-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #C4B8A8;
      margin: 0 0 18px;
    }
    .detail-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #C4B8A8;
      display: block;
      margin-bottom: 2px;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 600;
      color: #1e2235;
    }
    .card-desc {
      font-size: 13.5px;
      color: #6B7280;
      line-height: 1.7;
      margin: 0;
      border-top: 1px solid #F0EDE8;
      padding-top: 18px;
    }

    /* ── CTA ── */
    .cta-btn {
      display: inline-block;
      background: #0d0d12;
     color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      padding: 15px 36px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(13,13,18,0.18), 0 1px 3px rgba(13,13,18,0.10);
      white-space: nowrap;
    }
    .cta-note {
      font-size: 12.5px;
      color: #9CA3AF;
      line-height: 1.6;
      margin: 0;
    }
    .cta-note strong { color: #6B7280; font-weight: 600; }

    /* ── Footer ── */
    .footer-link {
      font-size: 11px;
      color: #B0A898;
      text-decoration: none;
      font-weight: 500;
    }

    /* ════════════════════════════════
       MOBILE  ≤ 620 px
    ════════════════════════════════ */
    @media only screen and (max-width: 620px) {
      .outer-pad   { padding: 24px 12px 48px !important; }
      .card-wrap   { border-radius: 16px !important; }

      /* Header */
      .header-pad  { padding: 28px 24px 0 !important; }
      .brand-row   { margin-bottom: 24px !important; }
      .h1          { font-size: 26px !important; }
      .headline-pad { padding-bottom: 24px !important; }

      /* Strip */
      .job-strip          { padding: 16px 24px !important; }
      .strip-inner-table  { width: 100% !important; }
      .strip-left-cell,
      .strip-right-cell   { display: block !important; width: 100% !important; }
      .strip-divider-cell { display: none !important; }
      .strip-right-cell   { padding-top: 12px !important; padding-left: 0 !important; }
      .strip-title        { white-space: normal !important; }

      /* Body */
      .body-pad    { padding: 28px 24px 24px !important; }

      /* Detail grid: stack to single column */
      .detail-grid-table  { width: 100% !important; }
      .detail-grid-row td { display: block !important; width: 100% !important; padding-bottom: 14px !important; }

      /* CTA row: stack */
      .cta-table         { width: 100% !important; }
      .cta-btn-cell      { display: block !important; width: 100% !important; text-align: center !important; }
      .cta-note-cell     { display: block !important; width: 100% !important; padding-left: 0 !important; padding-top: 12px !important; }

      /* Footer */
      .footer-pad        { padding: 20px 24px 28px !important; }
      .footer-brand-cell,
      .footer-links-cell { display: block !important; width: 100% !important; }
      .footer-links-cell { padding-top: 12px !important; padding-left: 0 !important; }
      .footer-link-sep   { display: none !important; }
      .footer-links-cell a { display: block !important; margin-bottom: 8px !important; }
    }
  </style>
</head>
<body>

<div class="outer-pad" style="background:#EDEAE4;padding:48px 16px 72px;">
<div class="card-wrap" style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 2px 4px rgba(13,13,18,0.04),0 12px 40px rgba(13,13,18,0.09),0 40px 80px rgba(13,13,18,0.05);">

  <!-- ══ HEADER ══ -->
  <div class="header-pad" style="background:#FFFFFF;padding:44px 48px 0;border-bottom:1.5px solid #F0EDE8;">

    <!-- Wordmark + chip -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="brand-row" style="margin-bottom:36px;">
      <tr>
        <td>
          <span class="wordmark">Talk<span class="wordmark-accent">2</span>Hire</span>
        </td>
        <td align="right">
          <span class="chip">
            <span class="chip-dot"></span>
            New Job Alert
          </span>
        </td>
      </tr>
    </table>

    <!-- Motivational headline -->
    <div class="headline-pad" style="padding-bottom:36px;">
      <p class="eyebrow">Your next opportunity</p>
      <h1 class="h1">Your dream role<br/>just <em>became available.</em></h1>
      <p class="subtext">
        A new position was just posted on
        <strong style="color:#1e2235;font-weight:600;">Talk2Hire</strong>.
        Top candidates act within 24 hours.
      </p>
    </div>

    <!-- Job summary strip -->
    <div class="job-strip">
      <table role="presentation" class="strip-inner-table" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td class="strip-left-cell" style="vertical-align:middle;">
            <p class="strip-company">${job.company}</p>
            <p class="strip-title">${job.title}</p>
          </td>
          <td class="strip-divider-cell" style="width:1px;padding:0 24px;">
            <div style="width:1px;height:36px;background:#E5E3DF;"></div>
          </td>
          <td class="strip-right-cell" style="vertical-align:middle;text-align:right;">
            <p class="strip-meta">📍 <strong>${job.location || "Remote"}</strong></p>
            <p class="strip-meta">💼 <strong>${job.type || "Full-time"}</strong></p>
            ${job.salary ? `<p class="strip-meta">💰 <strong>${job.salary}</strong></p>` : ""}
          </td>
        </tr>
      </table>
    </div>

  </div>
  <!-- /HEADER -->

  <!-- ══ BODY ══ -->
  <div class="body-pad" style="padding:40px 48px 36px;">

    <!-- Role detail card -->
    <div class="role-card">
      <p class="card-label">Role Details</p>

      <!-- 2-col detail grid via table -->
      <table role="presentation" class="detail-grid-table" cellpadding="0" cellspacing="0" style="width:100%;${shortDesc ? "margin-bottom:20px;" : ""}">
        <tr class="detail-grid-row">
          ${job.department ? `<td style="width:50%;vertical-align:top;padding-bottom:16px;padding-right:16px;"><span class="detail-label">Department</span><span class="detail-value">${job.department}</span></td>` : "<td></td>"}
          ${job.experience ? `<td style="width:50%;vertical-align:top;padding-bottom:16px;"><span class="detail-label">Experience</span><span class="detail-value">${job.experience}</span></td>` : "<td></td>"}
        </tr>
        <tr class="detail-grid-row">
          <td style="width:50%;vertical-align:top;padding-right:16px;"><span class="detail-label">Location</span><span class="detail-value">${job.location || "Remote"}</span></td>
          ${job.salary ? `<td style="width:50%;vertical-align:top;"><span class="detail-label">Salary</span><span class="detail-value">${job.salary}</span></td>` : "<td></td>"}
        </tr>
      </table>

      ${shortDesc ? `<p class="card-desc">${shortDesc}</p>` : ""}
    </div>

    <!-- Skills (injected externally as skillsHTML) -->
    ${skillsHTML}

    <!-- CTA -->
    <table role="presentation" class="cta-table" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:36px;">
      <tr>
        <td class="cta-btn-cell" style="vertical-align:middle;width:auto;">
          <a href="${appUrl}/jobs/${job.id}" class="cta-btn">View Job &amp; Apply →</a>
        </td>
        <td class="cta-note-cell" style="vertical-align:middle;padding-left:20px;">
          <p class="cta-note">
            <strong>Act fast.</strong><br/>
            Roles like this typically close within 3–5 days.
          </p>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:1.5px solid #F0EDE8;margin:0 0 28px;"/>

    <p style="font-size:12px;color:#C4B8A8;text-align:center;line-height:1.8;margin:0;">
      You're getting this because you subscribed to job alerts on Talk2Hire.<br/>
      <a href="${appUrl}/api/v1/unsubscribe?token=${unsubscribeToken}"
         style="color:#d97706;text-decoration:none;font-weight:600;">Unsubscribe</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/jobs" style="color:#C4B8A8;text-decoration:none;">Browse all jobs</a>
    </p>

  </div>
  <!-- /BODY -->

  <!-- ══ FOOTER ══ -->
  <div class="footer-pad" style="background:#F7F5F2;border-top:1.5px solid #F0EDE8;padding:28px 48px 36px;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #EAE7E2;">
      <tr>
        <td class="footer-brand-cell" style="vertical-align:middle;">
          <span style="font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:900;color:#1e2235;letter-spacing:-0.3px;">
            Talk<span style="color:#d97706;">2</span>Hire
          </span>
        </td>
        <td class="footer-links-cell" style="vertical-align:middle;text-align:right;padding-left:16px;">
          <a href="${appUrl}/jobs"    class="footer-link">Browse Jobs</a>
          <span class="footer-link-sep" style="color:#D5CFC8;font-size:11px;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
          <a href="${appUrl}/privacy" class="footer-link">Privacy Policy</a>
          <span class="footer-link-sep" style="color:#D5CFC8;font-size:11px;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
          <a href="${appUrl}/contact" class="footer-link">Contact</a>
        </td>
      </tr>
    </table>

    <p style="font-size:11px;color:#C4B8A8;line-height:1.7;text-align:center;margin:0;">
      © ${year} Talk2Hire · A subsidiary of QuantumHash Corporation<br/>
      Wilmington, DE 19801, USA · talk2hire.com
    </p>

  </div>
  <!-- /FOOTER -->

</div>
</div>

</body>
</html>`.trim();
};

/* ─────────────────────────────────────────────
   Helper: welcome confirmation HTML
───────────────────────────────────────────── */
const buildWelcomeHTML = (unsubscribeToken) => {
  const appUrl = process.env.CORS_ORIGIN || "https://talk2hire.com";
  return `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:40px;background:#fff;border-radius:12px;border:1px solid #eee;">
  <h2 style="color:#1e2235;margin:0 0 12px;">You're in! ✨</h2>
  <p style="color:#555;margin:0 0 20px;">
    Thanks for subscribing. You'll be the first to know when new jobs are
    posted on <strong>Talk2Hire</strong>.
  </p>
  <p style="font-size:12px;color:#aaa;margin:0;">
    Didn't sign up?
    <a href="${appUrl}/api/v1/unsubscribe?token=${unsubscribeToken}" style="color:#d97706;">
      Unsubscribe
    </a>
  </p>
</div>`.trim();
};

/* ══════════════════════════════════════════════
   1. POST /api/v1/subscribe
      Body: { email }
══════════════════════════════════════════════ */
const subscribeNewsletter = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new APIERR(400, "Please provide a valid email address.");
  }

  const normalised = email.toLowerCase().trim();

  const [rows] = await db.query(
    "SELECT id, is_active, unsubscribe_token FROM newsletter_subscribers WHERE email = ?",
    [normalised],
  );

  if (rows.length > 0) {
    const existing = rows[0];

    if (existing.is_active) {
      throw new APIERR(409, "You're already subscribed!");
    }

    await db.query(
      "UPDATE newsletter_subscribers SET is_active = 1, unsubscribed_at = NULL, subscribed_at = NOW() WHERE id = ?",
      [existing.id],
    );

    await sendMail(
      normalised,
      "Welcome back to Talk2Hire job alerts!",
      "You're re-subscribed to job alerts on Talk2Hire.",
      buildWelcomeHTML(existing.unsubscribe_token),
    );

    return res
      .status(200)
      .json(new APIRES(200, null, "Welcome back! You're subscribed again 🎉"));
  }

  const token = crypto.randomBytes(32).toString("hex");

  await db.query(
    "INSERT INTO newsletter_subscribers (email, unsubscribe_token) VALUES (?, ?)",
    [normalised, token],
  );

  sendMail(
    normalised,
    "🎉 You're subscribed to Talk2Hire job alerts!",
    "Thanks for subscribing. You'll hear from us when new jobs are posted.",
    buildWelcomeHTML(token),
  ).catch((err) => console.error("[Newsletter] Welcome email failed:", err));

  return res
    .status(201)
    .json(new APIRES(201, null, "You're subscribed! 🎉 Check your inbox."));
});

/* ══════════════════════════════════════════════
   2. GET /api/v1/unsubscribe?token=xxx
══════════════════════════════════════════════ */
const unsubscribeNewsletter = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw new APIERR(400, "Invalid unsubscribe link.");
  }

  const [rows] = await db.query(
    "SELECT id, is_active FROM newsletter_subscribers WHERE unsubscribe_token = ?",
    [token],
  );

  if (rows.length === 0) {
    throw new APIERR(404, "Subscriber not found.");
  }

  await db.query(
    "UPDATE newsletter_subscribers SET is_active = 0, unsubscribed_at = NOW() WHERE id = ?",
    [rows[0].id],
  );

  const appUrl = process.env.CORS_ORIGIN || "https://talk2hire.com";
  return res.redirect(`${appUrl}/unsubscribed`);
});

/* ══════════════════════════════════════════════
   3. sendJobAlertToAll(job)  — internal helper
══════════════════════════════════════════════ */
const sendJobAlertToAll = async (job) => {
  const [subscribers] = await db.query(
    "SELECT email, unsubscribe_token FROM newsletter_subscribers WHERE is_active = 1",
  );

  if (subscribers.length === 0) {
    console.log("[Newsletter] No active subscribers — skipping job alert.");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const subject = `🚀 New Job: ${job.title} at ${job.company}`;
  const text = `A new job has been posted on Talk2Hire: ${job.title} at ${job.company}. Visit ${process.env.CORS_ORIGIN}/jobs/${job.id} to apply.`;

  const BATCH = 50;
  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH);

    await Promise.allSettled(
      batch.map(async ({ email, unsubscribe_token }) => {
        try {
          await sendMail(
            email,
            subject,
            text,
            buildJobAlertHTML(job, unsubscribe_token),
          );
          sent++;
        } catch (err) {
          console.error(
            `[Newsletter] Failed to send to ${email}:`,
            err.message,
          );
          failed++;
        }
      }),
    );

    if (i + BATCH < subscribers.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`[Newsletter] Alert sent → ${sent} ok, ${failed} failed`);
  return { sent, failed };
};

/* ══════════════════════════════════════════════
   4. POST /api/v1/notify-job  (protected)
══════════════════════════════════════════════ */
const notifyJobToSubscribers = asyncHandler(async (req, res) => {
  const { job } = req.body;

  if (!job?.title || !job?.company) {
    throw new APIERR(400, "job.title and job.company are required.");
  }

  const result = await sendJobAlertToAll(job);

  return res
    .status(200)
    .json(
      new APIRES(
        200,
        result,
        `Job alert sent to ${result.sent} subscriber(s).`,
      ),
    );
});

const newsLetter = asyncHandler(async (req, res) => {
  throw new APIERR(
    400,
    "Use /subscribe, /unsubscribe or /notify-job endpoints.",
  );
});

module.exports = {
  newsLetter,
  subscribeNewsletter,
  unsubscribeNewsletter,
  notifyJobToSubscribers,
  sendJobAlertToAll,
};
