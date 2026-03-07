import React, { useState } from "react";

// ── Data ────────────────────────────────────────────────────────────────────

const cookieTypes = [
  {
    name: "Strictly Necessary",
    badge: "Always Active",
    badgeColor: "bg-gray-900 text-white",
    icon: "🔒",
    description:
      "These cookies are essential for our website to function and cannot be switched off. They are usually set in response to actions you take such as logging in, filling in forms, or setting privacy preferences. Without these cookies, our services cannot operate properly.",
    examples: [
      {
        name: "session_id",
        purpose: "Maintains your login session",
        duration: "Session",
      },
      {
        name: "csrf_token",
        purpose: "Prevents cross-site request forgery attacks",
        duration: "Session",
      },
      {
        name: "auth_token",
        purpose: "Authenticates your account securely",
        duration: "30 days",
      },
      {
        name: "cookie_consent",
        purpose: "Stores your cookie preferences",
        duration: "1 year",
      },
    ],
  },
  {
    name: "Performance & Analytics",
    badge: "Optional",
    badgeColor: "bg-gray-100 text-gray-600",
    icon: "📊",
    description:
      "These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our platform. They help us understand which pages are most popular, how visitors move through the site, and where they may encounter issues.",
    examples: [
      {
        name: "_ga",
        purpose: "Google Analytics — distinguishes unique users",
        duration: "2 years",
      },
      {
        name: "_gid",
        purpose: "Google Analytics — identifies user session",
        duration: "24 hours",
      },
      {
        name: "_gat",
        purpose: "Google Analytics — throttles request rate",
        duration: "1 minute",
      },
      {
        name: "hotjar_*",
        purpose: "Heatmaps and session recordings",
        duration: "1 year",
      },
    ],
  },
  {
    name: "Functional",
    badge: "Optional",
    badgeColor: "bg-gray-100 text-gray-600",
    icon: "⚙️",
    description:
      "These cookies enable enhanced functionality and personalisation. They may be set by us or by third-party providers whose services we have added to our pages. If you do not allow these cookies, some or all of these services may not function properly.",
    examples: [
      {
        name: "lang_pref",
        purpose: "Stores your language preference",
        duration: "1 year",
      },
      {
        name: "theme_pref",
        purpose: "Remembers your UI theme preference",
        duration: "1 year",
      },
      {
        name: "timezone",
        purpose: "Stores your timezone for scheduling features",
        duration: "Session",
      },
      {
        name: "intercom-*",
        purpose: "Powers our in-app support chat widget",
        duration: "9 months",
      },
    ],
  },
  {
    name: "Targeting & Marketing",
    badge: "Optional",
    badgeColor: "bg-gray-100 text-gray-600",
    icon: "🎯",
    description:
      "These cookies may be set through our site by our advertising partners. They may be used to build a profile of your interests and show you relevant adverts on other sites. They do not directly store personal information but uniquely identify your browser.",
    examples: [
      {
        name: "_fbp",
        purpose: "Facebook Pixel — tracks ad conversions",
        duration: "3 months",
      },
      {
        name: "li_fat_id",
        purpose: "LinkedIn — measures ad campaign effectiveness",
        duration: "30 days",
      },
      {
        name: "_gcl_au",
        purpose: "Google Ads — conversion tracking",
        duration: "3 months",
      },
    ],
  },
];

const sections = [
  {
    id: "what-are-cookies",
    number: "01",
    title: "What Are Cookies?",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Cookies are small data files placed on your computer or mobile device
          when you visit a website. They are widely used to make websites work
          efficiently, remember your preferences, and provide information to
          site owners.
        </p>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Cookies may contain unique identifiers that are considered personal
          information under certain data protection laws. Talk2Hire uses cookies
          and similar technologies (including web beacons, pixels, and local
          storage) across our platform.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {[
            {
              label: "First-party cookies",
              desc: "Set directly by Talk2Hire on our domain.",
            },
            {
              label: "Third-party cookies",
              desc: "Set by trusted partners like analytics providers.",
            },
            {
              label: "Session cookies",
              desc: "Deleted when you close your browser.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-gray-100 rounded-xl p-4 bg-gray-50"
            >
              <p className="text-xs font-semibold text-gray-800 mb-1">
                {item.label}
              </p>
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
    id: "how-we-use",
    number: "02",
    title: "How We Use Cookies",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Talk2Hire uses cookies and similar technologies to operate and improve
          our AI-powered hiring platform. Specifically, we use them to:
        </p>
        <ul className="space-y-2">
          {[
            "Keep you signed in and maintain your session securely.",
            "Remember your preferences such as language, timezone, and UI settings.",
            "Understand how candidates and employers use our platform so we can improve it.",
            "Measure the effectiveness of our marketing campaigns.",
            "Prevent fraud and ensure the security of our services.",
            "Provide relevant personalised content and job recommendations.",
            "Power our AI interview tools and applicant tracking features.",
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
    ),
  },
  {
    id: "cookie-types",
    number: "03",
    title: "Types of Cookies We Use",
    content: (
      <div className="space-y-6">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          We categorise the cookies we use into four types. Below is a detailed
          breakdown of each category and the specific cookies placed on your
          device.
        </p>
        {cookieTypes.map((type) => (
          <div
            key={type.name}
            className="border border-gray-100 rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">{type.icon}</span>
                <span className="text-sm font-semibold text-gray-800">
                  {type.name}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold tracking-widest uppercase px-3 py-1 rounded-full ${type.badgeColor}`}
              >
                {type.badge}
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-500 font-light leading-relaxed mb-4">
                {type.description}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left font-semibold text-gray-400 tracking-wider uppercase pb-2 pr-4">
                        Cookie Name
                      </th>
                      <th className="text-left font-semibold text-gray-400 tracking-wider uppercase pb-2 pr-4">
                        Purpose
                      </th>
                      <th className="text-left font-semibold text-gray-400 tracking-wider uppercase pb-2">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {type.examples.map((ex, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 last:border-0"
                      >
                        <td className="py-2.5 pr-4 font-mono text-gray-700 font-medium">
                          {ex.name}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500 font-light">
                          {ex.purpose}
                        </td>
                        <td className="py-2.5 text-gray-400 whitespace-nowrap">
                          {ex.duration}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "third-party",
    number: "04",
    title: "Third-Party Cookies",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          In addition to our own cookies, we partner with trusted third-party
          services. Each provider maintains their own cookie and privacy
          policies.
        </p>
        <div className="space-y-3">
          {[
            {
              provider: "Google Analytics",
              purpose: "Website analytics and user behaviour insights",
              link: "https://policies.google.com/privacy",
              optout: "https://tools.google.com/dlpage/gaoptout",
            },
            {
              provider: "Google Ads",
              purpose: "Conversion tracking and remarketing",
              link: "https://policies.google.com/privacy",
              optout: "https://adssettings.google.com",
            },
            {
              provider: "LinkedIn Insight Tag",
              purpose: "B2B advertising and conversion measurement",
              link: "https://www.linkedin.com/privacy-policy",
              optout: "https://www.linkedin.com/psettings/guest-controls",
            },
            {
              provider: "Intercom",
              purpose: "In-app messaging and customer support",
              link: "https://www.intercom.com/privacy",
              optout: null,
            },
            {
              provider: "Hotjar",
              purpose: "Session recordings and heatmaps",
              link: "https://www.hotjar.com/privacy",
              optout: "https://www.hotjar.com/legal/compliance/opt-out",
            },
          ].map((p) => (
            <div
              key={p.provider}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 border border-gray-100 rounded-xl px-5 py-3.5"
            >
              <div className="sm:w-40 shrink-0">
                <span className="text-sm font-semibold text-gray-800">
                  {p.provider}
                </span>
              </div>
              <p className="flex-1 text-sm text-gray-500 font-light">
                {p.purpose}
              </p>
              <div className="flex gap-3 shrink-0">
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-gray-400 hover:text-gray-900 border-b border-gray-200 hover:border-gray-900 transition-colors duration-150"
                >
                  Policy ↗
                </a>
                {p.optout && (
                  <a
                    href={p.optout}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-gray-400 hover:text-gray-900 border-b border-gray-200 hover:border-gray-900 transition-colors duration-150"
                  >
                    Opt-out ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "managing-cookies",
    number: "05",
    title: "Managing Your Cookies",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          You have several ways to control cookies. Please note that disabling
          certain cookies may affect the functionality of our platform.
        </p>
        <div className="space-y-4">
          {[
            {
              title: "Cookie Consent Banner",
              desc: "When you first visit Talk2Hire, you can choose which cookie categories to accept or reject through our consent banner. You can update your preferences at any time by clicking 'Cookie Settings' in the footer.",
            },
            {
              title: "Browser Settings",
              desc: "Most browsers allow you to control cookies through their settings. You can block or delete cookies, though this may impair platform features. Visit your browser's help documentation for instructions.",
            },
            {
              title: "Google Analytics Opt-Out",
              desc: "Install the Google Analytics opt-out browser add-on from https://tools.google.com/dlpage/gaoptout to prevent your data from being used by Google Analytics.",
            },
            {
              title: "Do Not Track",
              desc: "Some browsers have a 'Do Not Track' feature. Talk2Hire currently does not respond to DNT signals, but we continue to monitor industry standards in this space.",
            },
            {
              title: "Mobile Devices",
              desc: "On mobile devices, you can reset your advertising identifier in your device settings. This limits the data tied to your device across apps and websites.",
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
      </div>
    ),
  },
  {
    id: "legal-basis",
    number: "06",
    title: "Legal Basis for Cookie Use",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          We use cookies on the following legal grounds:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              basis: "Legitimate Interests",
              desc: "For strictly necessary cookies required to operate our platform and maintain security.",
            },
            {
              basis: "Consent",
              desc: "For all optional cookie categories — analytics, functional, and marketing. You may withdraw consent at any time.",
            },
            {
              basis: "Legal Obligation",
              desc: "Where applicable laws require us to maintain certain records or logs for compliance.",
            },
            {
              basis: "Contract Performance",
              desc: "Where cookies are necessary to deliver a service you have specifically requested.",
            },
          ].map((item) => (
            <div
              key={item.basis}
              className="border border-gray-100 rounded-xl p-4 bg-gray-50"
            >
              <p className="text-xs font-semibold text-gray-800 mb-1.5">
                {item.basis}
              </p>
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
    id: "data-transfers",
    number: "07",
    title: "International Data Transfers",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Some cookies set by third-party providers may transfer data outside
          your country. Where this occurs to countries outside the EEA, UK, or
          Switzerland, we ensure appropriate safeguards are in place — including
          Standard Contractual Clauses — to protect your personal information.
        </p>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Our own first-party data is processed in the United States. By using
          our platform, users outside the US acknowledge this transfer.
        </p>
      </div>
    ),
  },
  {
    id: "updates",
    number: "08",
    title: "Updates to This Policy",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          We may update this Cookie Policy from time to time to reflect changes
          in the cookies we use, changes in applicable law, or other
          operational, legal, or regulatory reasons. We will notify you of
          material changes by updating the "Last updated" date at the top of
          this page.
        </p>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          We encourage you to periodically review this page to stay informed
          about our use of cookies. Continued use of Talk2Hire after changes
          take effect constitutes your acceptance of the updated policy.
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    number: "09",
    title: "Contact Us",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          If you have questions or concerns about our use of cookies or this
          Cookie Policy, please contact our privacy team:
        </p>
        <div className="space-y-2">
          {[
            {
              label: "General Privacy",
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
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 w-44">
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

// ── Chevron Icon ─────────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
const Cookies = () => {
  const [openSection, setOpenSection] = useState("what-are-cookies");
  const toggle = (id) => setOpenSection(openSection === id ? null : id);

  return (
    <>
      <title>Cookie Policy | Talk2Hire</title>
      <meta
        name="description"
        content="Learn how Talk2Hire uses cookies and similar technologies on our AI-powered hiring platform."
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://talk2hire.com/cookies" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div
        className="min-h-screen bg-white text-gray-900"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Grid texture */}
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
                Legal Document
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400 font-light">
                Last updated: August 7th, 2025
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400 font-light">
                Version 1.0
              </span>
            </div>

            {/* Hero */}
            <div className="border-t-2 border-gray-900 pt-14 pb-14 grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium mb-5">
                  Talk2Hire · Legal
                </p>
                <h1
                  className="text-6xl lg:text-7xl font-bold leading-none tracking-tight text-gray-900"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Cookie
                  <span
                    className="block font-normal italic text-gray-400"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Policy.
                  </span>
                </h1>
              </div>
              <div>
                <p className="text-[15px] leading-relaxed text-gray-500 font-light mb-7">
                  This Cookie Policy explains how Talk2Hire uses cookies and
                  similar tracking technologies when you visit our platform, and
                  how you can control them.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["GDPR Compliant", "CCPA Ready", "ePrivacy Directive"].map(
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

          {/* ── Nav strip ── */}
          <nav
            className="border-t border-b border-gray-200 flex overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`shrink-0 text-[11px] font-medium tracking-widest uppercase px-4 py-3.5 border-r border-gray-200 transition-colors duration-200 whitespace-nowrap outline-none
                  ${openSection === s.id ? "text-gray-900 bg-gray-50" : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"}`}
              >
                {s.title}
              </button>
            ))}
          </nav>

          {/* ── Cookie Type Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
            {cookieTypes.map((type) => (
              <div
                key={type.name}
                className="border border-gray-100 rounded-2xl p-4 hover:border-gray-300 transition-colors duration-200 cursor-default"
              >
                <span className="text-2xl block mb-2">{type.icon}</span>
                <p className="text-xs font-semibold text-gray-800 leading-snug mb-1">
                  {type.name}
                </p>
                <span
                  className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full ${type.badgeColor}`}
                >
                  {type.badge}
                </span>
              </div>
            ))}
          </div>

          {/* ── Accordion Sections ── */}
          <main className="mt-10 pb-20 space-y-0">
            {sections.map((section) => {
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
                    {/* Title row */}
                    <div className="flex items-center justify-between gap-4">
                      <h2
                        className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {section.title}
                      </h2>
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

                  {/* Body */}
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

          {/* ── Quick links ── */}
          <div className="border-t border-gray-100 py-10">
            <p className="text-[10px] font-medium tracking-widest uppercase text-gray-400 mb-5">
              Related Documents
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
                {
                  label: "Privacy Notice for Candidates",
                  href: "/privacy-candidates",
                },
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
            </div>
            <p className="text-sm text-gray-400 font-light">
              Cookie questions?{" "}
              <a
                href="mailto:support@talk2hire.com"
                className="text-gray-900 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-200"
              >
                support@talk2hire.com
              </a>
            </p>
            <p className="text-xs text-gray-300 tracking-wide">
              v1.0 · August 2025
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

export default Cookies;
