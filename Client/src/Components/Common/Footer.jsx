import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";
import {
  Twitter,
  Linkedin,
  Github,
  ArrowUpRight,
  Sparkles,
  MapPin,
  Mail,
  ArrowRight,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Design tokens (same as HomeComponents)
───────────────────────────────────────────── */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
  .footer-root { font-family: 'DM Sans', sans-serif; }
  .footer-root h1, .footer-root h2, .footer-root h3 {
    font-family: 'Playfair Display', Georgia, serif;
  }
`;

const NAV_LINKS = {
  Product: [
    { label: "Find Jobs", to: "/jobs" },
    { label: "Companies", to: "/companies" },
    { label: "Salary Explorer", to: "/salaries" },
    { label: "AI Mock Interview", to: "/practice" },
  ],
  Company: [
    { label: "About", to: "/about" },
    { label: "Blog", to: "/blog" },
    { label: "Careers", to: "/careers" },
    { label: "Contact", to: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", to: "/privacy" },
    { label: "Terms of Service", to: "/terms" },
    { label: "Security", to: "/security" },
    { label: "Cookie Policy", to: "/cookies" },
  ],
};

const SOCIALS = [
  { Icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { Icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
  { Icon: Github, href: "https://github.com", label: "GitHub" },
];

const Footer = () => {
  const ref = useRef(null);

  /* ── Mouse-reveal animation for the watermark ── */
  const mouseX = useMotionValue(-600);
  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 22 });

  /* Ink-colored reveal mask that sweeps across the text */
  const maskImage = useTransform(
    smoothX,
    (x) =>
      `radial-gradient(ellipse 220px 80px at ${x}px 50%, black 0%, transparent 100%)`,
  );

  const handleMouseMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) mouseX.set(e.clientX - rect.left);
  };

  return (
    <footer
      ref={ref}
      onMouseMove={handleMouseMove}
      className="footer-root relative overflow-hidden bg-white border-t border-[rgba(13,13,18,0.09)]"
    >
      <style>{TOKENS}</style>

      {/* ── Top accent bar ── */}
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#d97706] to-transparent opacity-30" />

      {/* ── Subtle radial glow (warm amber, very light) ── */}
      <div className="absolute pointer-events-none inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(217,119,6,0.06),transparent_65%)]" />
      <div className="absolute pointer-events-none inset-0 bg-[radial-gradient(ellipse_at_0%_80%,rgba(124,58,237,0.04),transparent_55%)]" />

      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-0">
        {/* ════════════════════════════════════════
            TOP GRID
        ════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-16 border-b border-[rgba(13,13,18,0.07)]">
          {/* Brand col — spans 2 on lg */}
          <div className="lg:col-span-2">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                style={{
                  background: "linear-gradient(135deg,#1e2235,#2d3352)",
                }}
              >
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-[#0d0d12]">
                Talk2Hire
              </span>
            </div>

            <p className="text-sm leading-relaxed text-[rgba(13,13,18,0.60)] max-w-xs mb-6">
              The AI-powered careers platform that matches you to verified
              roles, prepares you for interviews, and gets you hired faster.
            </p>

            {/* Newsletter micro-form */}
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(13,13,18,0.40)] mb-3">
              Stay in the loop
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex gap-2 max-w-xs"
            >
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#faf9f7] border border-[rgba(13,13,18,0.09)] focus-within:border-[#1e2235] focus-within:shadow-[0_0_0_3px_rgba(30,34,53,0.07)] transition-all">
                <Mail
                  size={13}
                  className="text-[rgba(13,13,18,0.35)] flex-shrink-0"
                />
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 bg-transparent text-xs text-[#0d0d12] placeholder:text-[rgba(13,13,18,0.35)] outline-none"
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#1e2235] text-white text-xs font-semibold hover:bg-[#2d3352] transition-colors flex-shrink-0"
              >
                <ArrowRight size={14} />
              </motion.button>
            </form>

            {/* Socials */}
            <div className="flex items-center gap-2 mt-6">
              {SOCIALS.map(({ Icon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center border border-[rgba(13,13,18,0.09)] bg-[#faf9f7] text-[rgba(13,13,18,0.50)] hover:text-[#1e2235] hover:border-[rgba(13,13,18,0.20)] hover:shadow-[0_4px_12px_rgba(13,13,18,0.08)] transition-all"
                >
                  <Icon size={15} />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Nav link columns */}
          {Object.entries(NAV_LINKS).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.25em] text-[rgba(13,13,18,0.35)] mb-5">
                {group}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map(({ label, to }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="group inline-flex items-center gap-1 text-sm text-[rgba(13,13,18,0.60)] hover:text-[#0d0d12] transition-colors"
                    >
                      <span>{label}</span>
                      <ArrowUpRight
                        size={11}
                        className="opacity-0 -translate-y-0.5 translate-x-0 group-hover:opacity-60 group-hover:-translate-y-1 group-hover:translate-x-0.5 transition-all"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ════════════════════════════════════════
            BOTTOM BAR
        ════════════════════════════════════════ */}
        <div className="flex flex-col items-center justify-between gap-3 py-5 text-xs text-[rgba(13,13,18,0.40)] md:flex-row border-b border-[rgba(13,13,18,0.06)]">
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="opacity-60" />
            <span>Bengaluru, India</span>
          </div>

          <p className="text-center">
            © {new Date().getFullYear()}{" "}
            <span className="font-semibold text-[rgba(13,13,18,0.65)]">
              Talk2Hire
            </span>
            . All rights reserved.
          </p>

          <p>
            A subsidiary of{" "}
            <a
              href="https://quantumhash.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[rgba(13,13,18,0.55)] hover:text-[#0d0d12] transition-colors"
            >
              QuantumHash Corporation
            </a>
          </p>
        </div>

        {/* ════════════════════════════════════════
            WATERMARK  "Talk2Hire"
            Base layer  = very faint ink tint
            Reveal layer = crisp dark ink, masked by
                           radial spotlight following cursor
        ════════════════════════════════════════ */}
        <div className="relative h-[clamp(100px,18vw,280px)] select-none pointer-events-none overflow-hidden">
          {/* Layer 1 — always-visible ghost */}
          <h1
            className="absolute bottom-[-4%] left-0 w-full text-center font-extrabold tracking-tighter leading-none"
            style={{
              fontSize: "clamp(80px, 18vw, 280px)",
              color: "transparent",
              WebkitTextStroke: "1.5px rgba(13,13,18,0.07)",
            }}
          >
            Talk2Hire
          </h1>

          {/* Layer 2 — filled ghosted fill, very faint */}
          <h1
            className="absolute bottom-[-4%] left-0 w-full text-center font-extrabold tracking-tighter leading-none"
            style={{
              fontSize: "clamp(80px, 18vw, 280px)",
              color: "rgba(13,13,18,0.04)",
            }}
          >
            Talk2Hire
          </h1>

          {/* Layer 3 — amber gradient fill, medium opacity */}
          <h1
            className="absolute bottom-[-4%] left-0 w-full text-center font-extrabold tracking-tighter leading-none"
            style={{
              fontSize: "clamp(80px, 18vw, 280px)",
              background:
                "linear-gradient(135deg, #d97706 0%, #1e2235 60%, #7c3aed 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              opacity: 0.12,
            }}
          >
            Talk2Hire
          </h1>

          {/* Layer 4 — crisp ink text revealed by mouse spotlight */}
          <motion.h1
            style={{
              WebkitMaskImage: maskImage,
              maskImage,
              fontSize: "clamp(80px, 18vw, 280px)",
            }}
            className="absolute bottom-[-4%] left-0 w-full text-center font-extrabold tracking-tighter leading-none text-[#1e2235]"
          >
            Talk2Hire
          </motion.h1>

          {/* Layer 5 — amber shimmer strip revealed by spotlight */}
          <motion.h1
            style={{
              WebkitMaskImage: maskImage,
              maskImage,
              fontSize: "clamp(80px, 18vw, 280px)",
              background:
                "linear-gradient(135deg, #d97706 0%, #f59e0b 40%, #1e2235 80%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              opacity: 0.6,
            }}
            className="absolute bottom-[-4%] left-0 w-full text-center font-extrabold tracking-tighter leading-none"
          >
            Talk2Hire
          </motion.h1>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
