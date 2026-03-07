import React, { useState } from "react";

// ── Data ─────────────────────────────────────────────────────────────────────

const trustBadges = [
  { icon: "🔒", label: "TLS 1.3", sub: "Encryption in transit" },
  { icon: "🛡️", label: "AES-256", sub: "Encryption at rest" },
  { icon: "✅", label: "SOC 2 Type II", sub: "Independently audited" },
  { icon: "🌐", label: "GDPR Ready", sub: "EU data protection" },
];

const pillars = [
  {
    id: "infrastructure",
    number: "01",
    title: "Infrastructure Security",
    icon: "🏗️",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Talk2Hire's platform is hosted on enterprise-grade cloud
          infrastructure with multi-layer security controls applied at every
          level — from physical data centers to application logic.
        </p>
        {[
          {
            title: "Cloud Hosting",
            desc: "Our services run on AWS infrastructure across multiple availability zones, ensuring high availability, automatic failover, and geographic redundancy. All data centers are SOC 2, ISO 27001, and PCI-DSS certified.",
          },
          {
            title: "Network Isolation",
            desc: "We use Virtual Private Clouds (VPCs) with strict inbound and outbound rules. All internal services communicate over private networks. No sensitive service is ever exposed directly to the public internet.",
          },
          {
            title: "DDoS Protection",
            desc: "We employ AWS Shield Advanced and Cloudflare WAF to detect and absorb distributed denial-of-service attacks before they reach our application layer, maintaining platform availability for all users.",
          },
          {
            title: "Intrusion Detection",
            desc: "Automated intrusion detection systems (IDS) continuously monitor network traffic for anomalies. Security events are triaged in real time by our on-call security team and SIEM tooling.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-2 border-gray-100 pl-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
              {item.title}
            </p>
            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "data-security",
    number: "02",
    title: "Data Security & Encryption",
    icon: "🔐",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Every piece of data entrusted to Talk2Hire is treated with the highest
          level of care. We apply encryption at multiple layers so your data is
          protected whether it is moving or at rest.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              label: "In Transit",
              value: "TLS 1.3",
              desc: "All data between your device and our servers is encrypted using TLS 1.3 — the strongest protocol available.",
            },
            {
              label: "At Rest",
              value: "AES-256",
              desc: "All databases, file storage, and backups are encrypted at rest using AES-256 bit encryption.",
            },
            {
              label: "Key Management",
              value: "AWS KMS",
              desc: "Encryption keys are managed through AWS Key Management Service with automatic rotation policies.",
            },
            {
              label: "Database",
              value: "Encrypted RDS",
              desc: "All relational databases run on encrypted Amazon RDS instances with automated backups.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-gray-100 rounded-xl p-4 bg-gray-50"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">
                  {item.label}
                </p>
                <span className="text-[10px] font-bold tracking-widest uppercase bg-gray-900 text-white px-2 py-0.5 rounded-full">
                  {item.value}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-light leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
        <div className="border-l-2 border-gray-100 pl-4 mt-2">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Backup & Recovery
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            Automated encrypted backups are taken daily and retained for 30
            days. We conduct regular disaster recovery drills to validate our
            ability to restore services within defined RTO and RPO targets.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "access-control",
    number: "03",
    title: "Access Control",
    icon: "🗝️",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          We operate on a strict least-privilege access model. No employee,
          system, or service has access to resources beyond what is necessary to
          perform its defined function.
        </p>
        {[
          {
            title: "Multi-Factor Authentication",
            desc: "MFA is mandatory for all Talk2Hire employees accessing production systems. We enforce hardware security keys (FIDO2/WebAuthn) for privileged access roles.",
          },
          {
            title: "Role-Based Access Control (RBAC)",
            desc: "Every team member is assigned the minimum permissions required for their role. Access is reviewed quarterly and immediately revoked upon offboarding.",
          },
          {
            title: "Privileged Access Management",
            desc: "All privileged access to production databases and infrastructure requires approval via our PAM system, with full audit trails of every session recorded and retained.",
          },
          {
            title: "Single Sign-On (SSO)",
            desc: "Internal systems are accessed through centralized SSO with continuous session validation, reducing the risk of credential theft and unauthorized access.",
          },
          {
            title: "Zero-Trust Architecture",
            desc: "We implement zero-trust networking principles — every request is authenticated and authorized regardless of whether it originates inside or outside our network perimeter.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-2 border-gray-100 pl-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
              {item.title}
            </p>
            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "application-security",
    number: "04",
    title: "Application Security",
    icon: "⚙️",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Security is baked into our software development lifecycle (SDLC), not
          bolted on afterwards. Every line of code that reaches production has
          passed through multiple automated and manual security checks.
        </p>
        {[
          {
            title: "Secure SDLC",
            desc: "Our engineering team follows OWASP Top 10 guidelines and receives regular secure coding training. Security requirements are defined at the design stage of every feature.",
          },
          {
            title: "Automated Security Scanning",
            desc: "Every pull request is scanned by static analysis (SAST) and dependency vulnerability tools. Builds with high-severity findings are automatically blocked from merging.",
          },
          {
            title: "Penetration Testing",
            desc: "We engage independent third-party security firms to conduct comprehensive penetration tests at least annually. Critical findings are remediated within 24 hours; high severity within 7 days.",
          },
          {
            title: "Web Application Firewall",
            desc: "All traffic is inspected by a WAF configured to detect and block SQL injection, cross-site scripting (XSS), CSRF, and other common application-layer attacks.",
          },
          {
            title: "Dependency Management",
            desc: "Third-party libraries are continuously monitored for known CVEs using automated tooling. Vulnerable dependencies are patched or replaced according to our SLA.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-2 border-gray-100 pl-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
              {item.title}
            </p>
            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "ai-security",
    number: "05",
    title: "AI & Data Pipeline Security",
    icon: "🤖",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Our AI-powered interview and matching systems are held to the same
          rigorous security standards as our core platform — with additional
          controls specific to model security and data integrity.
        </p>
        {[
          {
            title: "Model Isolation",
            desc: "AI inference services run in isolated compute environments. Candidate interview data used for assessments is processed in dedicated pipelines that are logically separated from other workloads.",
          },
          {
            title: "Prompt Injection Prevention",
            desc: "We implement multi-layer defenses against prompt injection attacks in our AI interview and chat systems, including input sanitization, output validation, and adversarial prompt testing.",
          },
          {
            title: "Training Data Governance",
            desc: "Any data used to fine-tune or improve our AI models is anonymized, aggregated, and subject to our strict data governance policies. Models are audited for bias and fairness before deployment.",
          },
          {
            title: "Output Monitoring",
            desc: "AI-generated outputs — including interview transcripts and assessments — are continuously monitored for anomalies, inappropriate content, and signs of adversarial manipulation.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-2 border-gray-100 pl-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
              {item.title}
            </p>
            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "compliance",
    number: "06",
    title: "Compliance & Certifications",
    icon: "📜",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Talk2Hire maintains a comprehensive compliance program aligned with
          leading international security and privacy frameworks.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: "SOC 2 Type II",
              desc: "Independently audited controls for security, availability, and confidentiality.",
              status: "Certified",
            },
            {
              label: "GDPR",
              desc: "Full compliance with EU General Data Protection Regulation requirements.",
              status: "Compliant",
            },
            {
              label: "CCPA",
              desc: "California Consumer Privacy Act compliance for US-based users.",
              status: "Compliant",
            },
            {
              label: "ISO 27001",
              desc: "Information security management system standards. Certification in progress.",
              status: "In Progress",
            },
            {
              label: "HIPAA",
              desc: "Health data handling standards applied where applicable to sensitive candidate data.",
              status: "Aligned",
            },
            {
              label: "ePrivacy",
              desc: "EU ePrivacy Directive compliance for cookies and electronic communications.",
              status: "Compliant",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-gray-100 rounded-xl p-4 bg-gray-50"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-xs font-bold text-gray-800">{item.label}</p>
                <span
                  className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full shrink-0
                  ${
                    item.status === "Certified" || item.status === "Compliant"
                      ? "bg-gray-900 text-white"
                      : item.status === "In Progress"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-light leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "incident-response",
    number: "07",
    title: "Incident Response",
    icon: "🚨",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Despite best efforts, security incidents can occur. We maintain a
          documented, rehearsed incident response plan to detect, contain, and
          resolve security events with minimal impact on our users.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
          {[
            { phase: "Detect", time: "< 15 min", desc: "Automated alerts" },
            { phase: "Contain", time: "< 1 hr", desc: "Isolate threat" },
            { phase: "Notify", time: "< 72 hrs", desc: "User communication" },
            { phase: "Resolve", time: "< 7 days", desc: "Full remediation" },
          ].map((item) => (
            <div
              key={item.phase}
              className="border border-gray-100 rounded-xl p-3 text-center bg-gray-50"
            >
              <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-1">
                {item.phase}
              </p>
              <p
                className="text-base font-bold text-gray-900 mb-0.5"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {item.time}
              </p>
              <p className="text-[10px] text-gray-400 font-light">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
        {[
          {
            title: "24/7 Monitoring",
            desc: "Our security operations are supported by continuous monitoring tools and an on-call rotation ensuring someone is always watching for threats, around the clock.",
          },
          {
            title: "Breach Notification",
            desc: "In the event of a confirmed data breach affecting personal information, we will notify impacted users within 72 hours as required by GDPR, and comply with all applicable breach notification regulations.",
          },
          {
            title: "Post-Incident Review",
            desc: "Every significant security incident triggers a blameless post-mortem process. Findings are used to update our controls, procedures, and training to prevent recurrence.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-2 border-gray-100 pl-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
              {item.title}
            </p>
            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "employee-security",
    number: "08",
    title: "Employee Security",
    icon: "👥",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Security starts with people. Every Talk2Hire team member is a link in
          our security chain, and we invest heavily in ensuring that link is
          strong.
        </p>
        {[
          {
            title: "Background Checks",
            desc: "All employees and contractors with access to production systems or sensitive data undergo thorough background checks before onboarding.",
          },
          {
            title: "Security Awareness Training",
            desc: "Every employee completes mandatory security awareness training at onboarding and annually thereafter. This includes phishing simulation exercises and social engineering awareness.",
          },
          {
            title: "Acceptable Use Policy",
            desc: "All employees sign and adhere to our Acceptable Use Policy governing how company data, systems, and devices may be used. Violations are treated as disciplinary matters.",
          },
          {
            title: "Secure Offboarding",
            desc: "When an employee leaves Talk2Hire, all access is revoked within one hour of their departure. Company devices are wiped and credentials are rotated immediately.",
          },
          {
            title: "Device Management",
            desc: "All company-issued devices are enrolled in our MDM (Mobile Device Management) solution with full-disk encryption, remote wipe capability, and automatic OS patching enforced.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-2 border-gray-100 pl-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
              {item.title}
            </p>
            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "vulnerability-disclosure",
    number: "09",
    title: "Vulnerability Disclosure",
    icon: "🐛",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          We welcome responsible disclosure from the security research
          community. If you believe you have discovered a security vulnerability
          in Talk2Hire, we want to hear from you.
        </p>
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-700 mb-3">
            How to Report
          </p>
          <ul className="space-y-2">
            {[
              "Email your finding to security@talk2hire.com with a detailed description.",
              "Include steps to reproduce, the potential impact, and any supporting evidence.",
              "Do not exploit the vulnerability or access user data beyond what is needed to demonstrate the issue.",
              "Allow us a reasonable time to investigate and remediate before public disclosure.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-gray-500 font-light leading-relaxed"
              >
                <span className="mt-2 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: "Response SLA",
              value: "48 hours",
              desc: "Initial acknowledgement of your report.",
            },
            {
              label: "Triage SLA",
              value: "7 days",
              desc: "Assessment and severity classification.",
            },
            {
              label: "Patch SLA",
              value: "30 days",
              desc: "Target remediation for critical findings.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-gray-100 rounded-xl p-4 text-center bg-gray-50"
            >
              <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-1">
                {item.label}
              </p>
              <p
                className="text-xl font-bold text-gray-900 mb-0.5"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {item.value}
              </p>
              <p className="text-[10px] text-gray-400 font-light">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Safe Harbor
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            Researchers who report vulnerabilities in good faith and in
            accordance with this policy will not face legal action from
            Talk2Hire. We appreciate the security community's contribution to
            keeping our platform safe.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "contact",
    number: "10",
    title: "Security Contact",
    icon: "📬",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          For security-related questions, vulnerability reports, or concerns
          about the safety of your data on Talk2Hire, please contact our
          security and privacy teams directly.
        </p>
        <div className="space-y-2">
          {[
            {
              label: "Security Team",
              value: "security@talk2hire.com",
              href: "mailto:security@talk2hire.com",
            },
            {
              label: "Privacy & Data",
              value: "support@talk2hire.com",
              href: "mailto:support@talk2hire.com",
            },
            {
              label: "General Support",
              value: "support@talk2hire.com",
              href: "mailto:support@talk2hire.com",
            },
            {
              label: "Data Protection Officer",
              value: "support@talk2hire.com",
              href: "mailto:support@talk2hire.com",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-wrap items-center gap-3 border border-gray-100 rounded-xl px-5 py-3.5"
            >
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 w-52 shrink-0">
                {item.label}
              </span>
              <a
                href={item.href}
                className="text-sm text-gray-800 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-150"
              >
                {item.value}
              </a>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

// ── Chevron ──────────────────────────────────────────────────────────────────
const Chevron = ({ open }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

// ── Page ─────────────────────────────────────────────────────────────────────
const Security = () => {
  const [openSection, setOpenSection] = useState("infrastructure");
  const toggle = (id) => setOpenSection(openSection === id ? null : id);

  return (
    <>
      <title>Security | Talk2Hire</title>
      <meta
        name="description"
        content="Learn how Talk2Hire protects your data and keeps the platform secure with enterprise-grade security controls."
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://talk2hire.com/security" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div
        className="min-h-screen bg-white text-gray-900"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Subtle grid texture */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.022) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          {/* ── Header Meta ── */}
          <header className="pt-14">
            <div className="flex flex-wrap items-center gap-3 mb-14">
              <span className="text-[10px] font-medium tracking-widest uppercase text-gray-400 border border-gray-200 bg-gray-50 px-3 py-1.5 rounded-full">
                Trust & Safety
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400 font-light">
                Last updated: August 7th, 2025
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400 font-light">
                Version 2.0
              </span>
            </div>

            {/* Hero */}
            <div className="border-t-2 border-gray-900 pt-14 pb-14 grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium mb-5">
                  Talk2Hire · Security
                </p>
                <h1
                  className="text-6xl lg:text-7xl font-bold leading-none tracking-tight text-gray-900"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Security
                  <span
                    className="block font-normal italic text-gray-400"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Overview.
                  </span>
                </h1>
              </div>
              <div>
                <p className="text-[15px] leading-relaxed text-gray-500 font-light mb-7">
                  Security is foundational to everything we build at Talk2Hire.
                  This page outlines the controls, certifications, and practices
                  we use to protect your data, our platform, and your trust.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["SOC 2 Type II", "Zero Trust", "AES-256", "GDPR"].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium tracking-widest uppercase border border-gray-900 text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-900 hover:text-white transition-colors duration-200 cursor-default"
                      >
                        {tag}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* ── Trust Badge Strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="border border-gray-100 rounded-2xl p-4 hover:border-gray-300 transition-colors duration-200 cursor-default"
              >
                <span className="text-2xl block mb-2">{badge.icon}</span>
                <p className="text-xs font-bold text-gray-800 leading-snug mb-0.5">
                  {badge.label}
                </p>
                <p className="text-[10px] text-gray-400 font-light">
                  {badge.sub}
                </p>
              </div>
            ))}
          </div>

          {/* ── Security Posture Summary ── */}
          <div className="border border-gray-100 rounded-2xl p-6 mt-3 mb-2 bg-gray-50">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-4">
              At a Glance
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { metric: "99.9%", label: "Uptime SLA" },
                { metric: "72 hrs", label: "Breach notification" },
                { metric: "Annual", label: "Pen testing cadence" },
                { metric: "24 / 7", label: "Security monitoring" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p
                    className="text-2xl font-bold text-gray-900 mb-0.5"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {item.metric}
                  </p>
                  <p className="text-[10px] font-medium tracking-wider uppercase text-gray-400">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Nav strip ── */}
          <nav
            className="border-t border-b border-gray-200 flex overflow-x-auto mt-6"
            style={{ scrollbarWidth: "none" }}
          >
            {pillars.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`shrink-0 text-[11px] font-medium tracking-widest uppercase px-4 py-3.5 border-r border-gray-200 transition-colors duration-200 whitespace-nowrap outline-none
                  ${openSection === s.id ? "text-gray-900 bg-gray-50" : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"}`}
              >
                <span className="mr-1.5">{s.icon}</span>
                {s.title}
              </button>
            ))}
          </nav>

          {/* ── Accordion ── */}
          <main className="mt-0 pb-20">
            {pillars.map((section) => {
              const isOpen = openSection === section.id;
              return (
                <div
                  key={section.id}
                  id={section.id}
                  className="border-b border-gray-100 first:border-t first:border-gray-100"
                >
                  <button
                    onClick={() => toggle(section.id)}
                    className="w-full grid gap-8 md:gap-10 py-10 text-left group outline-none"
                    style={{ gridTemplateColumns: "88px 1fr" }}
                  >
                    {/* Number */}
                    <div className="pt-1">
                      <div
                        className={`text-5xl font-bold leading-none mb-3 transition-colors duration-300 select-none
                          ${isOpen ? "text-gray-900" : "text-gray-100 group-hover:text-gray-300"}`}
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {section.number}
                      </div>
                      <div
                        className={`h-0.5 transition-all duration-300
                          ${isOpen ? "w-8 bg-gray-900" : "w-4 bg-gray-200 group-hover:w-6 group-hover:bg-gray-400"}`}
                      />
                    </div>

                    {/* Title + chevron */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl hidden sm:block">
                          {section.icon}
                        </span>
                        <h2
                          className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {section.title}
                        </h2>
                      </div>
                      <span
                        className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300
                          ${
                            isOpen
                              ? "bg-gray-900 border-gray-900 text-white"
                              : "border-gray-300 text-gray-400 group-hover:border-gray-600 group-hover:text-gray-600"
                          }`}
                      >
                        <Chevron open={isOpen} />
                      </span>
                    </div>
                  </button>

                  {/* Expanded body */}
                  {isOpen && (
                    <div
                      className="grid gap-8 md:gap-10 pb-10"
                      style={{
                        gridTemplateColumns: "88px 1fr",
                        animation: "fadeSlide .25s ease",
                      }}
                    >
                      <div />
                      <div>{section.content}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </main>

          {/* ── Related docs ── */}
          <div className="border-t border-gray-100 py-10">
            <p className="text-[10px] font-medium tracking-widest uppercase text-gray-400 mb-5">
              Related Documents
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Cookie Policy", href: "/cookies" },
                { label: "Terms & Conditions", href: "/terms" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-xs font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors duration-200"
                >
                  {link.label} →
                </a>
              ))}
            </div>
          </div>

          {/* ── Footer ── */}
          <footer className="border-t-2 border-gray-900 py-12 flex flex-wrap items-center justify-between gap-6">
            <div
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Talk2Hire{" "}
              <span className="font-normal italic text-gray-400">Inc.</span>
            </div>
            <p className="text-sm text-gray-400 font-light">
              Security concerns?{" "}
              <a
                href="mailto:security@talk2hire.com"
                className="text-gray-900 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-200"
              >
                security@talk2hire.com
              </a>
            </p>
            <p className="text-xs text-gray-300 tracking-wide">
              v2.0 · August 2025
            </p>
          </footer>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </>
  );
};

export default Security;
