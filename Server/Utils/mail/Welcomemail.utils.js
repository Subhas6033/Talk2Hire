// ─── Welcome Email Templates ──────────────────────────────────────────────────

const buildUserWelcomeEmail = (fullName) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to Talk2Hire</title>
    <style>
      * { box-sizing: border-box; }
      body { margin:0; padding:0; background:#f4f6f8; font-family: Arial, Helvetica, sans-serif; }
      .container { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.08); overflow:hidden; }
      .header { background:linear-gradient(135deg,#1e2235 0%,#2d3352 60%,#3d4570 100%); padding:36px 32px; text-align:center; }
      .header h1 { margin:0; color:#fff; font-size:26px; font-weight:900; letter-spacing:-0.5px; }
      .header p  { margin:8px 0 0; color:rgba(255,255,255,.6); font-size:14px; }
      .badge { display:inline-flex; align-items:center; gap:6px; margin-top:14px; background:rgba(217,119,6,.2); border:1px solid rgba(217,119,6,.4); border-radius:999px; padding:5px 14px; font-size:11px; color:#fbbf24; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
      .body { padding:36px 32px; color:#374151; line-height:1.7; }
      .body p  { margin:0 0 14px; font-size:14px; }
      .steps { margin:24px 0; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
      .step { display:flex; align-items:flex-start; gap:14px; padding:16px 18px; border-bottom:1px solid #e5e7eb; }
      .step:last-child { border-bottom:none; }
      .step-num { flex-shrink:0; width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#1e2235,#3d4570); color:#fff; font-size:12px; font-weight:900; display:flex; align-items:center; justify-content:center; margin-top:2px; }
      .step-text strong { display:block; font-size:13px; color:#111827; margin-bottom:2px; }
      .step-text span { font-size:12px; color:#6b7280; }
      .feature-row { display:flex; gap:10px; margin:24px 0; }
      .feature-box { flex:1; padding:16px 12px; background:#faf9f7; border-radius:12px; border:1px solid #e5e7eb; text-align:center; }
      .feature-box .icon { font-size:24px; margin-bottom:8px; }
      .feature-box strong { display:block; font-size:12px; color:#111827; font-weight:700; }
      .feature-box span { font-size:11px; color:#9ca3af; }
      .cta-btn { display:inline-block; margin:8px 0 20px; padding:15px 36px; background:linear-gradient(135deg,#1e2235,#3d4570); color:#fff; border-radius:12px; font-size:15px; font-weight:700; text-decoration:none; letter-spacing:-0.2px; }
      .amber { color:#d97706; font-weight:700; }
      .footer { padding:18px 32px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Welcome to Talk2Hire 🎉</h1>
        <p>Your AI-powered job search platform</p>
        <div class="badge">✦ Job Seeker Account Created</div>
      </div>
      <div class="body">
        <p>Hi <strong>${fullName}</strong>,</p>
        <p>You're now part of a community of <span class="amber">12,000+ professionals</span> who've landed amazing roles through Talk2Hire. Here's how to make the most of your account:</p>

        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-text">
              <strong>Browse matched jobs</strong>
              <span>Our AI surfaces roles aligned to your skills — no noise, just signal.</span>
            </div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-text">
              <strong>Practice mock interviews</strong>
              <span>Rehearse with our AI interviewer before the real thing. Scored on clarity and depth.</span>
            </div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-text">
              <strong>Apply in one click</strong>
              <span>Your profile is pre-filled from your resume. Apply to multiple roles in seconds.</span>
            </div>
          </div>
        </div>

        <div class="feature-row">
          <div class="feature-box"><div class="icon">🎯</div><strong>AI Matching</strong><span>Personalized roles</span></div>
          <div class="feature-box"><div class="icon">🤖</div><strong>Mock Interview</strong><span>AI coaching</span></div>
          <div class="feature-box"><div class="icon">📊</div><strong>Salary Data</strong><span>Know your worth</span></div>
        </div>

        <a href="${process.env.CORS_ORIGIN || "https://talk2hire.com"}/dashboard" class="cta-btn">Go to My Dashboard →</a>

        <p style="font-size:13px; color:#6b7280;">
          Questions? Reply to this email or reach us at <a href="mailto:support@talk2hire.com" style="color:#d97706;">support@talk2hire.com</a>
        </p>
      </div>
      <div class="footer">&copy; 2026 Talk2Hire · QuantamHash Corporation · All rights reserved.</div>
    </div>
  </body>
</html>`;

const buildCompanyWelcomeEmail = (companyName) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to Talk2Hire — Company Portal</title>
    <style>
      * { box-sizing: border-box; }
      body { margin:0; padding:0; background:#f4f6f8; font-family: Arial, Helvetica, sans-serif; }
      .container { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.08); overflow:hidden; }
      .header { background:linear-gradient(135deg,#065f46 0%,#047857 60%,#059669 100%); padding:36px 32px; text-align:center; }
      .header h1 { margin:0; color:#fff; font-size:26px; font-weight:900; letter-spacing:-0.5px; }
      .header p  { margin:8px 0 0; color:rgba(255,255,255,.65); font-size:14px; }
      .badge { display:inline-flex; align-items:center; gap:6px; margin-top:14px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3); border-radius:999px; padding:5px 14px; font-size:11px; color:#fff; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
      .body { padding:36px 32px; color:#374151; line-height:1.7; }
      .body p  { margin:0 0 14px; font-size:14px; }
      .steps { margin:24px 0; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
      .step { display:flex; align-items:flex-start; gap:14px; padding:16px 18px; border-bottom:1px solid #e5e7eb; }
      .step:last-child { border-bottom:none; }
      .step-num { flex-shrink:0; width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#065f46,#059669); color:#fff; font-size:12px; font-weight:900; display:flex; align-items:center; justify-content:center; margin-top:2px; }
      .step-text strong { display:block; font-size:13px; color:#111827; margin-bottom:2px; }
      .step-text span { font-size:12px; color:#6b7280; }
      .feature-row { display:flex; gap:10px; margin:24px 0; }
      .feature-box { flex:1; padding:16px 12px; background:#f0fdf4; border-radius:12px; border:1px solid #d1fae5; text-align:center; }
      .feature-box .icon { font-size:24px; margin-bottom:8px; }
      .feature-box strong { display:block; font-size:12px; color:#111827; font-weight:700; }
      .feature-box span { font-size:11px; color:#9ca3af; }
      .cta-btn { display:inline-block; margin:8px 0 20px; padding:15px 36px; background:linear-gradient(135deg,#065f46,#059669); color:#fff; border-radius:12px; font-size:15px; font-weight:700; text-decoration:none; letter-spacing:-0.2px; }
      .green { color:#059669; font-weight:700; }
      .note-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 16px; font-size:13px; color:#065f46; margin:20px 0; }
      .footer { padding:18px 32px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Welcome to Talk2Hire 🏢</h1>
        <p>Your AI-powered hiring platform</p>
        <div class="badge">✦ Company Account Created</div>
      </div>
      <div class="body">
        <p>Hi <strong>${companyName}</strong>,</p>
        <p>Your company is now listed on Talk2Hire — where <span class="green">50,000+ job seekers</span> discover new opportunities every month. Start attracting top talent today.</p>

        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-text">
              <strong>Complete your company profile</strong>
              <span>Add your logo, culture overview, and company size to stand out to candidates.</span>
            </div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-text">
              <strong>Post your first job</strong>
              <span>Publish a role and our AI will instantly match it with pre-screened candidates.</span>
            </div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-text">
              <strong>Review AI-screened applicants</strong>
              <span>Candidates come with AI interview scores so you shortlist faster.</span>
            </div>
          </div>
        </div>

        <div class="feature-row">
          <div class="feature-box"><div class="icon">📋</div><strong>Post Jobs</strong><span>Unlimited listings</span></div>
          <div class="feature-box"><div class="icon">🤖</div><strong>AI Screening</strong><span>Pre-scored apps</span></div>
          <div class="feature-box"><div class="icon">👥</div><strong>50k+ Talent</strong><span>Active seekers</span></div>
        </div>

        <div class="note-box">
          💡 <strong>Pro tip:</strong> Companies with complete profiles get <strong>3× more applications</strong>. Head to your dashboard and fill out your company details first.
        </div>

        <a href="${process.env.CORS_ORIGIN || "https://talk2hire.com"}/company/dashboard" class="cta-btn">Go to Company Dashboard →</a>

        <p style="font-size:13px; color:#6b7280;">
          Need help getting started? Email us at <a href="mailto:support@talk2hire.com" style="color:#059669;">support@talk2hire.com</a>
        </p>
      </div>
      <div class="footer">&copy; 2026 Talk2Hire · QuantamHash Corporation · All rights reserved.</div>
    </div>
  </body>
</html>`;

module.exports = { buildUserWelcomeEmail, buildCompanyWelcomeEmail };
