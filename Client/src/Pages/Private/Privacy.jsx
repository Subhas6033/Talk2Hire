import React, { useState } from "react";

const sections = [
  {
    id: "who-we-are",
    number: "01",
    title: "Who We Are",
    content: [
      {
        text: `Talk2Hire ("Talk2Hire," "we," "us," or "our") is a recruitment platform that connects talented candidates with employers through our AI-powered interview and hiring platform. We are registered in the United States, with our registered office at Wilmington, DE 19801, USA.`,
      },
    ],
  },
  {
    id: "scope",
    number: "02",
    title: "Scope of This Policy",
    content: [
      {
        text: `This Privacy Policy applies to all users of our website (https://talk2hire.com) and related services. For candidates using our AI interviewer, please also review our separate Privacy Notice for Candidates.`,
      },
    ],
  },
  {
    id: "information-we-collect",
    number: "03",
    title: "Information We Collect",
    content: [
      {
        subtitle: "From All Users",
        bullets: [
          "Account information (name, email, company details).",
          "Usage data and analytics.",
          "Device and browser information.",
          "IP addresses and location data.",
        ],
      },
      {
        subtitle: "From Employers / Clients",
        bullets: [
          "Company information and hiring requirements.",
          "Employee contact details for authorized users.",
          "Payment and billing information.",
        ],
      },
      {
        subtitle: "From Candidates",
        text: "See our detailed Privacy Notice for Candidates for comprehensive information about candidate data processing.",
      },
    ],
  },
  {
    id: "how-we-use",
    number: "04",
    title: "How We Use Your Information",
    content: [
      {
        bullets: [
          "Service Delivery: To provide our recruitment platform and matching services.",
          "Communication: To send service-related communications and updates.",
          "Improvement: To analyze and improve our platform performance.",
          "Legal Compliance: To comply with applicable laws and regulations.",
          "AI Development: To train and improve our AI models (with appropriate safeguards).",
        ],
      },
    ],
  },
  {
    id: "legal-basis",
    number: "05",
    title: "Legal Basis for Processing",
    content: [
      {
        subtitle: "EU or UK Residents",
        text: "The GDPR and UK GDPR require us to explain the valid legal bases we rely on. We may rely on Contract Performance, Legitimate Interests, Consent, and Legal Obligations to process your personal information.",
      },
      {
        subtitle: "Canada Residents",
        text: "We process your personal data based on consent where you have given express or implied consent, and on legal exceptions where consent is not required under applicable Canadian law — such as for investigations, fraud prevention, certain business transactions, or where required by law.",
      },
    ],
  },
  {
    id: "data-sharing",
    number: "06",
    title: "Data Sharing & Recipients",
    content: [
      {
        bullets: [
          "Service Providers: Cloud hosting, analytics, and technical support providers.",
          "Business Partners: In connection with our recruitment services.",
          "Legal Authorities: When required by law or to protect our rights.",
          "Employers: For candidates, see our Privacy Notice for Candidates for detailed sharing information.",
        ],
      },
    ],
  },
  {
    id: "international-transfers",
    number: "07",
    title: "International Data Transfers",
    content: [
      {
        text: "Our services are hosted in the United States. If you access our services from outside the US, your data will be transferred to and processed in the United States. We implement appropriate safeguards for international transfers, including Standard Contractual Clauses where required.",
      },
    ],
  },
  {
    id: "cookies",
    number: "08",
    title: "Cookies & Tracking",
    content: [
      {
        text: "We use cookies and similar technologies (e.g., web beacons and pixels) to collect information when you interact with our Services. These help ensure security, prevent crashes, fix bugs, save your preferences, and enable core functionalities.",
      },
      {
        subtitle: "Google Analytics",
        text: "We may share information with Google Analytics to understand how users engage with our Services. To opt out, visit: https://tools.google.com/dlpage/gaoptout.",
      },
    ],
  },
  {
    id: "ai-use",
    number: "09",
    title: "Our Use of AI",
    content: [
      {
        text: "As part of our Services, we provide features powered by artificial intelligence, machine learning, and related technologies. These tools enhance your experience and provide smart, personalized solutions. Our AI Products support AI bots, AI applications, AI insights, AI search, machine learning models, natural language processing, text analysis, video analysis, and voice analysis.",
      },
      {
        subtitle: "How We Process Your Data Using AI",
        text: "All personal information processed through our AI Products is managed in accordance with this Privacy Policy and any applicable agreements with third parties. We apply strict security measures and provide transparency about AI data use.",
      },
      {
        subtitle: "How to Opt Out",
        text: "If you wish to opt out of the use of AI Products, please contact us using the details provided in the Contact Us section of this Privacy Policy.",
      },
    ],
  },
  {
    id: "data-retention",
    number: "10",
    title: "Data Retention",
    content: [
      {
        text: "We retain your data for as long as necessary to provide our services and comply with legal obligations. When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize it. Specific retention periods vary by data type and are detailed in our Privacy Notice for Candidates for candidate data.",
      },
    ],
  },
  {
    id: "security",
    number: "11",
    title: "Data Security",
    content: [
      {
        text: "We implement technical and organizational measures to protect your data against unauthorized access, loss, alteration, or disclosure. However, no method of transmission over the internet is 100% secure. You should only access the Services within a secure environment.",
      },
      {
        subtitle: "Minors or Children's Data",
        text: "We do not knowingly collect, solicit, or sell personal data of individuals under 18. By using our Services, you confirm you are at least 18 or have consent from a parent or legal guardian. If you believe we may have collected data from a minor, please contact us at support@talk2hire.com.",
      },
    ],
  },
  {
    id: "your-rights",
    number: "12",
    title: "Your Rights",
    content: [
      {
        subtitle: "EEA, UK, Switzerland & Canada Residents",
        bullets: [
          "Access: Request access to your personal data.",
          "Rectification: Correct inaccurate or incomplete data.",
          "Erasure: Request deletion of your data.",
          "Restriction: Limit how we process your data.",
          "Portability: Receive your data in a portable format.",
          "Objection: Object to certain types of processing.",
          "Withdraw Consent: Where processing is based on consent.",
        ],
      },
      {
        subtitle: "US Residents",
        text: "Residents of California, Colorado, Connecticut, Texas, Virginia, and other US states may request details about the data we hold, correct inaccuracies, or request deletion. Some may also opt out of targeted advertising or data profiling. Rights may vary by state.",
      },
    ],
  },
  {
    id: "contact",
    number: "13",
    title: "Contact Us",
    content: [
      {
        text: "For privacy-related questions or to exercise your rights, please reach out to us:",
      },
      {
        bullets: [
          "Email: support@talk2hire.com",
          "Data Protection Officer: support@talk2hire.com",
          "Address: Wilmington, DE 19801, USA",
        ],
      },
      {
        subtitle: "Complaints",
        text: "You have the right to lodge a complaint with your local data protection authority if you believe we have not handled your data appropriately.",
      },
    ],
  },
];

const ChevronIcon = ({ open }) => (
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

const Privacy = () => {
  const [activeSection, setActiveSection] = useState(null);

  const toggle = (id) => setActiveSection(activeSection === id ? null : id);

  return (
    <>
      <title>Privacy Policy | Talk2Hire</title>
      <meta
        name="description"
        content="Read the Privacy Policy of Talk2Hire to understand how we collect, use, and protect your personal information and data."
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://talk2hire.com/privacy" />

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div
        className="min-h-screen bg-white text-gray-900"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Subtle grid background */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          {/* ── Header Meta ── */}
          <header className="pt-14">
            <div className="flex flex-wrap items-center gap-3 mb-14">
              <span className="text-xs font-medium tracking-widest uppercase text-gray-400 border border-gray-200 bg-gray-50 px-3 py-1 rounded-full">
                Legal Document
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400 font-light">
                Last updated: August 7th, 2025
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400 font-light">
                Version 2.1
              </span>
            </div>

            {/* ── Hero ── */}
            <div className="border-t-2 border-gray-900 pt-14 pb-14 grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
              <div>
                <p className="text-xs tracking-widest uppercase text-gray-400 font-medium mb-5">
                  Talk2Hire · Privacy
                </p>
                <h1
                  className="text-6xl lg:text-7xl font-bold leading-none tracking-tight text-gray-900"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Privacy
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
                  We believe privacy is a right, not a feature. This document
                  explains exactly what data we collect, why we collect it, and
                  how you remain in control of your information at every step.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["GDPR Compliant", "CCPA Ready", "SOC 2 Type II"].map(
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

          {/* ── Quick Nav ── */}
          <nav className="border-t border-b border-gray-200 flex overflow-x-auto scrollbar-hide">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`shrink-0 text-[11px] font-medium tracking-widest uppercase px-4 py-3.5 border-r border-gray-200 transition-colors duration-200 whitespace-nowrap
                  ${
                    activeSection === s.id
                      ? "text-gray-900 bg-gray-50"
                      : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"
                  }`}
              >
                {s.title}
              </button>
            ))}
          </nav>

          {/* ── Sections ── */}
          <main className="py-20 space-y-0">
            {sections.map((section) => {
              const isOpen = activeSection === section.id;
              return (
                <div
                  key={section.id}
                  id={section.id}
                  className="border-b border-gray-100 first:border-t first:border-gray-100"
                >
                  <button
                    onClick={() => toggle(section.id)}
                    className="w-full grid grid-cols-[88px_1fr] gap-8 md:gap-10 py-10 md:py-12 text-left group"
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
                        className={`h-0.5 transition-all duration-300 bg-gray-900
                          ${isOpen ? "w-8" : "w-4 bg-gray-200 group-hover:bg-gray-400 group-hover:w-6"}`}
                      />
                    </div>

                    {/* Title + chevron */}
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
                              : "border-gray-300 text-gray-400 group-hover:border-gray-500 group-hover:text-gray-600"
                          }`}
                      >
                        <ChevronIcon open={isOpen} />
                      </span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="grid grid-cols-[88px_1fr] gap-8 md:gap-10 pb-10 animate-[fadeSlide_0.25s_ease]">
                      <div />
                      <div className="space-y-6">
                        {section.content.map((item, i) => (
                          <div
                            key={i}
                            className="border-l-2 border-gray-100 pl-4"
                          >
                            {item.subtitle && (
                              <p className="text-[11px] font-medium tracking-widest uppercase text-gray-700 mb-2">
                                {item.subtitle}
                              </p>
                            )}
                            {item.text && (
                              <p className="text-sm leading-[1.8] text-gray-500 font-light">
                                {item.text}
                              </p>
                            )}
                            {item.bullets && (
                              <ul className="space-y-1.5 mt-1">
                                {item.bullets.map((b, j) => (
                                  <li
                                    key={j}
                                    className="flex items-start gap-2 text-sm text-gray-500 font-light leading-relaxed"
                                  >
                                    <span className="mt-2 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                                    {b}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </main>

          {/* ── Quick Access Links ── */}
          <div className="border-t border-gray-100 py-10">
            <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-5">
              Quick Access
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                {
                  label: "Privacy Notice for Candidates",
                  href: "/privacy-notice-candidates",
                },
                { label: "Cookie Policy", href: "/cookies" },
                {
                  label: "Terms of Service",
                  href: "/terms",
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
              Privacy questions?{" "}
              <a
                href="mailto:support@talk2hire.com"
                className="text-gray-900 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-200"
              >
                support@talk2hire.com
              </a>
            </p>
            <p className="text-xs text-gray-300 tracking-wide">
              v2.1 · August 2025
            </p>
          </footer>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
};

export default Privacy;
