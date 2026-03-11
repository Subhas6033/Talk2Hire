import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import {
  Twitter,
  Linkedin,
  Github,
  ArrowUpRight,
  Sparkles,
  MapPin,
  Mail,
  ArrowRight,
  Facebook,
  Instagram,
  Globe,
  Youtube,
  CheckCircle,
  Loader,
} from "lucide-react";
import axios from "axios";
const backendUrl = `${import.meta.env.VITE_BACKEND_URL}/api/v1/news`;

/* ─────────────────────────────────────────────
   Design tokens
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
    { label: "Admin", to: "/admin/login" },
  ],
};

const SOCIALS = [
  {
    Icon: Facebook,
    href: "https://www.facebook.com/profile.php?id=61582410893482",
    label: "Facebook",
  },
  {
    Icon: Instagram,
    href: "https://www.instagram.com/quantumhash_corporation/",
    label: "Instagram",
  },
  { Icon: Twitter, href: "https://x.com/QuantumhashCrp", label: "Twitter" },
  {
    Icon: Linkedin,
    href: "https://www.linkedin.com/company/quantumhash-corporation/",
    label: "LinkedIn",
  },
  {
    Icon: Youtube,
    href: "https://www.youtube.com/@QuantumHashCorporation",
    label: "Youtube",
  },
  { Icon: Globe, href: "https://quantumhash.me/", label: "Website" },
];

/* ─────────────────────────────────────────────
   Wave Social Buttons
───────────────────────────────────────────── */
const WaveSocials = () => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const getY = (i) => {
    if (hoveredIndex === null) return 0;
    const d = Math.abs(i - hoveredIndex);
    return d === 0 ? -10 : d === 1 ? -5 : d === 2 ? -2 : 0;
  };
  const getScale = (i) => {
    if (hoveredIndex === null) return 1;
    const d = Math.abs(i - hoveredIndex);
    return d === 0 ? 1.22 : d === 1 ? 1.1 : d === 2 ? 1.04 : 1;
  };
  const getBg = (i) => {
    if (hoveredIndex === null) return "#faf9f7";
    const d = Math.abs(i - hoveredIndex);
    return d === 0 ? "#fef3c7" : d === 1 ? "#fffbf0" : "#faf9f7";
  };
  const getBorder = (i) => {
    if (hoveredIndex === null) return "rgba(13,13,18,0.09)";
    const d = Math.abs(i - hoveredIndex);
    return d === 0
      ? "rgba(217,119,6,0.45)"
      : d === 1
        ? "rgba(217,119,6,0.22)"
        : "rgba(13,13,18,0.09)";
  };
  const getColor = (i) => {
    if (hoveredIndex === null) return "rgba(13,13,18,0.50)";
    const d = Math.abs(i - hoveredIndex);
    return d === 0 ? "#d97706" : d === 1 ? "#f59e0b" : "rgba(13,13,18,0.50)";
  };

  return (
    <div className="flex items-end gap-2 mt-6">
      {SOCIALS.map(({ Icon, href, label }, i) => (
        <motion.a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          whileTap={{ scale: 0.88 }}
          animate={{
            y: getY(i),
            scale: getScale(i),
            backgroundColor: getBg(i),
            borderColor: getBorder(i),
            color: getColor(i),
            boxShadow:
              hoveredIndex === i
                ? "0 6px 20px rgba(217,119,6,0.18), 0 1px 3px rgba(13,13,18,0.07)"
                : "0 1px 3px rgba(13,13,18,0.07)",
          }}
          transition={{
            y: { type: "spring", stiffness: 380, damping: 18 },
            scale: { type: "spring", stiffness: 380, damping: 18 },
            backgroundColor: { duration: 0.18 },
            borderColor: { duration: 0.18 },
            color: { duration: 0.18 },
            boxShadow: { duration: 0.18 },
          }}
          className="w-9 h-9 rounded-xl flex items-center justify-center border transition-colors"
          style={{
            backgroundColor: "#faf9f7",
            borderColor: "rgba(13,13,18,0.09)",
            color: "rgba(13,13,18,0.50)",
          }}
        >
          <Icon size={15} />
        </motion.a>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Newsletter Subscribe Form
───────────────────────────────────────────── */
const NewsletterForm = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setMessage("Please enter a valid email.");
      return;
    }
    setStatus("loading");
    try {
      // POST to backend controller
      const res = await axios.post(`${backendUrl}/subscribe`, { email });
      setStatus("success");
      setMessage(res.data.message || "You're subscribed!");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(
        err?.response?.data?.message || "Something went wrong. Try again.",
      );
    }
  };

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2.5 max-w-xs px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200"
      >
        <CheckCircle size={15} className="text-emerald-500 shrink-0" />
        <p className="text-xs text-emerald-700 font-medium">{message}</p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-xs">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#faf9f7] border transition-all
            ${status === "error" ? "border-red-300 shadow-[0_0_0_3px_rgba(239,68,68,0.07)]" : "border-[rgba(13,13,18,0.09)] focus-within:border-[#1e2235] focus-within:shadow-[0_0_0_3px_rgba(30,34,53,0.07)]"}`}
        >
          <Mail size={13} className="text-[rgba(13,13,18,0.35)] shrink-0" />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder="your@email.com"
            className="flex-1 bg-transparent text-xs text-[#0d0d12] placeholder:text-[rgba(13,13,18,0.35)] outline-none"
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="submit"
          disabled={status === "loading"}
          className="px-3.5 py-2 rounded-xl bg-[#1e2235] text-white text-xs font-semibold hover:bg-[#2d3352] transition-colors shrink-0 disabled:opacity-60"
        >
          {status === "loading" ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <ArrowRight size={14} />
          )}
        </motion.button>
      </form>
      {status === "error" && (
        <p className="mt-1.5 text-[11px] text-red-500 pl-1">{message}</p>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Watermark — original mouse-spotlight reveal
───────────────────────────────────────────── */
const GlowWatermark = ({ mouseX }) => {
  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 22 });
  const maskImage = useTransform(
    smoothX,
    (x) =>
      `radial-gradient(ellipse 220px 80px at ${x}px 50%, black 0%, transparent 100%)`,
  );

  return (
    <div className="relative h-[clamp(100px,18vw,280px)] select-none pointer-events-none overflow-hidden">
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
      <h1
        className="absolute bottom-[-4%] left-0 w-full text-center font-extrabold tracking-tighter leading-none"
        style={{
          fontSize: "clamp(80px, 18vw, 280px)",
          color: "rgba(13,13,18,0.04)",
        }}
      >
        Talk2Hire
      </h1>
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
  );
};

/* ─────────────────────────────────────────────
   Footer
───────────────────────────────────────────── */
const Footer = () => {
  const ref = useRef(null);
  const mouseX = useMotionValue(-600);
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
      <div className="h-0.5 w-full bg-linear-to-r from-transparent via-[#d97706] to-transparent opacity-30" />
      <div className="absolute pointer-events-none inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(217,119,6,0.06),transparent_65%)]" />
      <div className="absolute pointer-events-none inset-0 bg-[radial-gradient(ellipse_at_0%_80%,rgba(124,58,237,0.04),transparent_55%)]" />

      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-16 border-b border-[rgba(13,13,18,0.07)]">
          {/* Brand col */}
          <div className="lg:col-span-2">
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

            {/* ── Newsletter ── */}
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(13,13,18,0.40)] mb-3">
              Stay in the loop
            </p>
            {/* 🔔 Replaced inline form with NewsletterForm component */}
            <NewsletterForm />

            <WaveSocials />
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

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 py-5 text-xs text-[rgba(13,13,18,0.40)] md:flex-row border-b border-[rgba(13,13,18,0.06)]">
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="opacity-60" />
            <span>Wilmington, DE 19801, USA</span>
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

        <GlowWatermark mouseX={mouseX} />
      </div>
    </footer>
  );
};

export default Footer;
