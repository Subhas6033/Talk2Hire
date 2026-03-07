import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "../Components/Common/Input";
import { motion } from "motion/react";
import {
  MapPin,
  Mail,
  Phone,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Globe,
  ArrowRight,
  Send,
  Shield,
  Zap,
  Users,
} from "lucide-react";
import useReview from "../Hooks/useReviewHook";

/* ══════════════════════════════════════════
   Design Tokens — matches homepage palette
══════════════════════════════════════════ */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

  :root {
    --c-cream:    #faf9f7;
    --c-white:    #ffffff;
    --c-ink:      #0d0d12;
    --c-ink-70:   rgba(13,13,18,0.70);
    --c-ink-40:   rgba(13,13,18,0.40);
    --c-ink-12:   rgba(13,13,18,0.08);
    --c-ink-06:   rgba(13,13,18,0.04);
    --c-slate:    #1e2235;
    --c-slate-2:  #2d3352;
    --c-slate-3:  #3d4570;
    --c-amber:    #d97706;
    --c-amber-l:  #fef3c7;
    --c-amber-2:  #f59e0b;
    --c-amber-3:  #fde68a;
    --c-sage:     #059669;
    --c-sage-l:   #d1fae5;
    --c-border:   rgba(13,13,18,0.09);
    --sh-sm:  0 1px 3px rgba(13,13,18,.07), 0 1px 2px rgba(13,13,18,.05);
    --sh-md:  0 4px 18px rgba(13,13,18,.08), 0 2px 6px rgba(13,13,18,.05);
    --sh-lg:  0 20px 60px rgba(13,13,18,.11), 0 8px 20px rgba(13,13,18,.07);
    --sh-xl:  0 32px 80px rgba(13,13,18,.15);
  }

  .contact-root { font-family: 'DM Sans', sans-serif; }
  .contact-root h1, .contact-root h2, .contact-root h3 {
    font-family: 'Playfair Display', Georgia, serif;
  }

  /* Gold input fields */
  .field-gold label {
    font-family: 'DM Sans', sans-serif !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    color: var(--c-ink-70) !important;
    display: block;
    margin-bottom: 7px;
  }
  .field-gold input,
  .field-gold textarea {
    width: 100%;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 14px !important;
    font-weight: 400 !important;
    color: var(--c-ink) !important;
    background: var(--c-cream) !important;
    border: 1.5px solid var(--c-border) !important;
    border-radius: 14px !important;
    padding: 13px 18px !important;
    outline: none !important;
    transition: all 0.25s ease !important;
    -webkit-appearance: none;
  }
  .field-gold input::placeholder,
  .field-gold textarea::placeholder { color: var(--c-ink-40) !important; }
  .field-gold input:focus,
  .field-gold textarea:focus {
    border-color: var(--c-amber) !important;
    background: var(--c-white) !important;
    box-shadow: 0 0 0 3.5px rgba(217,119,6,0.10) !important;
  }
  .field-gold textarea { resize: none !important; height: 128px !important; }
  .field-gold .field-error, .field-gold p[role="alert"] {
    font-family: 'DM Sans', sans-serif !important;
    font-size: 12px !important;
    color: #dc2626 !important;
    margin-top: 5px;
  }
`;

/* ══════════════════════════════════════════
   Ambient corner glow blobs (subtle)
══════════════════════════════════════════ */
const CornerGlow = () => (
  <>
    <div
      className="absolute top-0 right-0 w-125 h-125 rounded-full pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 80% 20%, #fef3c7 0%, #fde68a 30%, transparent 70%)",
        opacity: 0.7,
        filter: "blur(60px)",
      }}
    />
    <div
      className="absolute bottom-0 left-0 w-100 h-100 rounded-full pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 20% 80%, #fef9ee 0%, #fde68a 25%, transparent 65%)",
        opacity: 0.55,
        filter: "blur(70px)",
      }}
    />
    <div
      className="absolute top-1/2 right-[-5%] w-75 h-75 rounded-full pointer-events-none"
      style={{
        background: "radial-gradient(circle, #fef3c7 0%, transparent 70%)",
        opacity: 0.4,
        filter: "blur(80px)",
      }}
    />
  </>
);

/* ══════════════════════════════════════════
   Grid texture (subtle)
══════════════════════════════════════════ */
const GridTexture = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage:
        "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
      backgroundSize: "52px 52px",
      opacity: 0.45,
    }}
  />
);

/* ══════════════════════════════════════════
   Section Pill label (matches homepage)
══════════════════════════════════════════ */
const SectionPill = ({ children }) => (
  <motion.div
    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-5"
    style={{
      background: "var(--c-amber-l)",
      borderColor: "rgba(217,119,6,0.25)",
    }}
    initial={{ opacity: 0, scale: 0.88 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.15, duration: 0.5 }}
  >
    <motion.span
      className="w-1.5 h-1.5 rounded-full"
      style={{ backgroundColor: "var(--c-amber)" }}
      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
      transition={{ duration: 1.8, repeat: Infinity }}
    />
    <span
      className="text-xs font-bold uppercase tracking-[0.2em]"
      style={{ color: "var(--c-amber)" }}
    >
      {children}
    </span>
  </motion.div>
);

/* ══════════════════════════════════════════
   Info Card Row
══════════════════════════════════════════ */
const InfoCard = ({ icon: Icon, label, value, delay }) => (
  <motion.div
    initial={{ opacity: 0, x: -16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    className="flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group hover:shadow-(--sh-md)"
    style={{
      background: "var(--c-white)",
      borderColor: "var(--c-border)",
      boxShadow: "var(--sh-sm)",
    }}
    whileHover={{ y: -2 }}
  >
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300"
      style={{ background: "var(--c-amber-l)" }}
    >
      <Icon size={17} style={{ color: "var(--c-amber)" }} />
    </div>
    <div>
      <p
        className="text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5"
        style={{ color: "var(--c-amber)" }}
      >
        {label}
      </p>
      <p className="text-sm font-medium" style={{ color: "var(--c-ink)" }}>
        {value}
      </p>
    </div>
  </motion.div>
);

/* ══════════════════════════════════════════
   Field Shell with stagger
══════════════════════════════════════════ */
const FieldShell = ({ children, delay }) => (
  <motion.div
    className="field-gold"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

/* ══════════════════════════════════════════
   Submit Button — matches homepage CTA style
══════════════════════════════════════════ */
const SubmitButton = ({ children, loading }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.97 }}
      className="relative overflow-hidden inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm cursor-pointer border-0 outline-none text-white disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "var(--c-slate)",
        boxShadow: hovered
          ? "0 12px 36px rgba(30,34,53,0.28), 0 4px 12px rgba(30,34,53,0.15)"
          : "var(--sh-md)",
        transition: "box-shadow 0.3s, transform 0.2s",
      }}
    >
      {loading ? (
        /* Spinner */
        <svg
          className="animate-spin"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : (
        <Send size={15} className="relative z-10" />
      )}
      <span className="relative z-10">{loading ? "Sending…" : children}</span>
      {!loading && (
        <motion.svg
          className="relative z-10"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ x: hovered ? 4 : 0 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </motion.svg>
      )}
    </motion.button>
  );
};

/* ══════════════════════════════════════════
   Social Buttons — wave hover animation
══════════════════════════════════════════ */
const SOCIAL_LINKS = [
  {
    icon: Facebook,
    title: "Facebook",
    url: "https://www.facebook.com/profile.php?id=61582410893482",
  },
  {
    icon: Instagram,
    title: "Instagram",
    url: "https://www.instagram.com/quantumhash_corporation/",
  },
  { icon: Twitter, title: "Twitter / X", url: "https://x.com/QuantumhashCrp" },
  {
    icon: Linkedin,
    title: "LinkedIn",
    url: "https://www.linkedin.com/company/quantumhash-corporation/",
  },
  { icon: Globe, title: "Website", url: "https://quantumhash.me/" },
];

const SocialBtnGroup = () => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const getY = (i) => {
    if (hoveredIndex === null) return 0;
    const dist = Math.abs(i - hoveredIndex);
    if (dist === 0) return -10;
    if (dist === 1) return -5;
    if (dist === 2) return -2;
    return 0;
  };

  const getScale = (i) => {
    if (hoveredIndex === null) return 1;
    const dist = Math.abs(i - hoveredIndex);
    if (dist === 0) return 1.22;
    if (dist === 1) return 1.1;
    if (dist === 2) return 1.04;
    return 1;
  };

  const getBg = (i) => {
    if (hoveredIndex === null) return "var(--c-white)";
    const dist = Math.abs(i - hoveredIndex);
    if (dist === 0) return "var(--c-amber-l)";
    if (dist === 1) return "#fffbf0";
    return "var(--c-white)";
  };

  const getBorder = (i) => {
    if (hoveredIndex === null) return "var(--c-border)";
    const dist = Math.abs(i - hoveredIndex);
    if (dist === 0) return "rgba(217,119,6,0.45)";
    if (dist === 1) return "rgba(217,119,6,0.22)";
    return "var(--c-border)";
  };

  const getColor = (i) => {
    if (hoveredIndex === null) return "var(--c-ink-70)";
    const dist = Math.abs(i - hoveredIndex);
    if (dist === 0) return "var(--c-amber)";
    if (dist === 1) return "var(--c-amber-2)";
    return "var(--c-ink-70)";
  };

  return (
    <div className="flex items-end gap-2">
      {SOCIAL_LINKS.map(({ icon: Icon, title, url }, i) => (
        <motion.button
          key={title}
          title={title}
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          whileTap={{ scale: 0.88 }}
          initial={{ opacity: 0, scale: 0, y: 10 }}
          animate={{
            opacity: 1,
            scale: getScale(i),
            y: getY(i),
            backgroundColor: getBg(i),
            borderColor: getBorder(i),
            color: getColor(i),
          }}
          transition={{
            opacity: { delay: 0.9 + i * 0.07, type: "spring", stiffness: 280 },
            scale: {
              delay: hoveredIndex !== null ? 0 : 0.9 + i * 0.07,
              type: "spring",
              stiffness: 380,
              damping: 18,
            },
            y: { type: "spring", stiffness: 380, damping: 18 },
            backgroundColor: { duration: 0.18 },
            borderColor: { duration: 0.18 },
            color: { duration: 0.18 },
          }}
          className="w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer"
          style={{
            boxShadow:
              hoveredIndex === i
                ? "0 6px 20px rgba(217,119,6,0.22), var(--sh-sm)"
                : "var(--sh-sm)",
          }}
        >
          <Icon size={15} />
        </motion.button>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════
   Trust Badge
══════════════════════════════════════════ */
const TrustBadge = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-1.5">
    <div
      className="w-5 h-5 rounded-md flex items-center justify-center"
      style={{ background: "var(--c-amber-l)" }}
    >
      <Icon size={11} style={{ color: "var(--c-amber)" }} />
    </div>
    <span
      className="text-xs font-semibold uppercase tracking-widest"
      style={{ color: "var(--c-ink-40)" }}
    >
      {label}
    </span>
  </div>
);

/* ══════════════════════════════════════════
   Divider Ornament
══════════════════════════════════════════ */
const Ornament = () => (
  <div className="flex items-center justify-center gap-3 mt-6 mb-2">
    <div
      className="h-px w-12 rounded-full"
      style={{
        background: "linear-gradient(90deg, transparent, var(--c-amber))",
      }}
    />
    <span style={{ color: "var(--c-amber)", fontSize: 10 }}>✦</span>
    <div
      className="h-px w-12 rounded-full"
      style={{
        background: "linear-gradient(90deg, var(--c-amber), transparent)",
      }}
    />
  </div>
);

/* ══════════════════════════════════════════
   Main ContactPage
══════════════════════════════════════════ */
const ContactPage = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  /* ── Redux-backed review hook ── */
  const { submitReview, loading, success, error } = useReview();

  /* Reset form on successful submission */
  useEffect(() => {
    if (success) reset();
  }, [success, reset]);

  const onSubmit = (data) => {
    submitReview({
      fullName: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
    });
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 36 },
    show: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  return (
    <>
      <style>{TOKENS}</style>

      {/* SEO — unchanged */}
      <title>Contact Talk2Hire | Get in Touch | Quantumhash Corporation</title>
      <meta
        name="description"
        content="Contact QuantamHash Corporation for business inquiries, partnerships, or support. Visit our San Francisco office or send us a message online."
      />
      <meta
        name="keywords"
        content="Contact, QuantamHash Corporation, business inquiry, support, San Francisco tech company"
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://talk2hire.com/contact" />
      <meta property="og:title" content="Contact QuantamHash Corporation" />
      <meta
        property="og:description"
        content="Reach out to our team for inquiries, partnerships, or support."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/contact" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Contact QuantamHash Corporation" />
      <meta
        name="twitter:description"
        content="Get in touch with QuantamHash Corporation."
      />
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "QuantamHash Corporation",
          url: "https://talk2hire.com",
          logo: "https://talk2hire.com/talk2hirelogo.png",
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+12027735851",
            contactType: "customer support",
            email: "support@talk2hire.com",
          },
          address: {
            "@type": "PostalAddress",
            streetAddress: "800 N King Street, Suite 304",
            addressLocality: "Wilmington",
            addressRegion: "DE",
            postalCode: "19801",
            addressCountry: "US",
          },
        })}
      </script>

      {/* ── ROOT ── */}
      <motion.div
        className="contact-root relative min-h-screen overflow-hidden"
        style={{ background: "var(--c-white)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Grid + corners */}
        <GridTexture />
        <CornerGlow />

        {/* Decorative rings — top right */}
        <div
          className="absolute top-8 right-12 w-48 h-48 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.12)" }}
        />
        <div
          className="absolute top-16 right-20 w-28 h-28 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.08)" }}
        />
        {/* Decorative rings — bottom left */}
        <div
          className="absolute bottom-16 left-8 w-40 h-40 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.10)" }}
        />
        <div
          className="absolute bottom-28 left-16 w-24 h-24 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.07)" }}
        />

        {/* ── Page body ── */}
        <div className="relative z-10 min-h-screen px-4 sm:px-6 py-24 flex flex-col items-center">
          {/* ── Hero heading ── */}
          <motion.div
            className="text-center mb-16 max-w-7xl"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <SectionPill>We're available — say hello</SectionPill>

            <h1
              className="mb-5 leading-[1.06] tracking-tight"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(40px, 6vw, 72px)",
                fontWeight: 900,
                color: "var(--c-ink)",
              }}
            >
              Let's Begin a{" "}
              <span
                className="relative inline-block"
                style={{ fontStyle: "italic", fontWeight: 700 }}
              >
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-3) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Conversation
                </span>
                <svg
                  className="absolute -bottom-1 left-0 w-full"
                  viewBox="0 0 300 8"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.9, duration: 0.8, ease: "easeOut" }}
                    d="M4 5 Q75 1 150 5 Q225 9 296 4"
                    stroke="#d97706"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>
            </h1>

            <p
              className="text-base leading-relaxed mx-auto max-w-md"
              style={{ color: "var(--c-ink-70)", fontWeight: 400 }}
            >
              Whether it's a bold idea, a partnership, or simply a question —
              our team is here and delighted to connect.
            </p>

            <Ornament />
          </motion.div>

          {/* ── Cards Grid ── */}
          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ══ LEFT: Map + Info ══ */}
            <motion.div
              custom={0}
              variants={cardVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col"
            >
              <motion.div
                className="flex-1 rounded-3xl overflow-hidden border"
                style={{
                  background: "var(--c-white)",
                  borderColor: "var(--c-border)",
                  boxShadow: "var(--sh-md)",
                }}
                whileHover={{ boxShadow: "var(--sh-lg)", y: -5 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className="h-1"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--c-amber), var(--c-amber-2), var(--c-amber-3))",
                  }}
                />

                <div className="p-8">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.2em] mb-1"
                    style={{ color: "var(--c-amber)" }}
                  >
                    Find us here
                  </p>
                  <h2
                    className="mb-7"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "var(--c-ink)",
                      lineHeight: 1.2,
                    }}
                  >
                    Contact Information
                  </h2>

                  <motion.div
                    className="rounded-2xl overflow-hidden mb-6 border"
                    style={{
                      borderColor: "var(--c-border)",
                      boxShadow: "var(--sh-sm)",
                      height: 210,
                    }}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.55, duration: 0.55 }}
                  >
                    <iframe
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d49095.04744780296!2d-75.56929861897386!3d39.72975571863246!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c70f185c46af6f%3A0x8516da5077308c00!2sWilmington%2C%20DE%2C%20USA!5e0!3m2!1sen!2sin!4v1772794824476!5m2!1sen!2sin"
                      width="100%"
                      height="100%"
                      style={{ border: 0, display: "block" }}
                      allowFullScreen=""
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </motion.div>

                  <div className="flex flex-col gap-3">
                    <InfoCard
                      icon={Mail}
                      label="Email"
                      value="support@talk2hire.com"
                      delay={0.5}
                    />
                    <InfoCard
                      icon={Phone}
                      label="Phone"
                      value="+12027735851 (Only message, no Call)"
                      delay={0.58}
                    />
                    <InfoCard
                      icon={MapPin}
                      label="Address"
                      value="Wilmington, DE 19801, USA"
                      delay={0.66}
                    />
                  </div>

                  <motion.div
                    className="flex items-center gap-3 mt-7 pt-6"
                    style={{ borderTop: "1px solid var(--c-border)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.85 }}
                  >
                    <span
                      className="text-xs font-bold uppercase tracking-widest mr-1"
                      style={{ color: "var(--c-ink-40)" }}
                    >
                      Follow us
                    </span>
                    <SocialBtnGroup />
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>

            {/* ══ RIGHT: Form ══ */}
            <motion.div
              custom={1}
              variants={cardVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col"
            >
              <motion.div
                className="flex-1 rounded-3xl overflow-hidden border"
                style={{
                  background: "var(--c-white)",
                  borderColor: "var(--c-border)",
                  boxShadow: "var(--sh-md)",
                }}
                whileHover={{ boxShadow: "var(--sh-lg)", y: -5 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className="h-1"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--c-amber-3), var(--c-amber-2), var(--c-amber))",
                  }}
                />

                <div className="p-8">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.2em] mb-1"
                    style={{ color: "var(--c-amber)" }}
                  >
                    Drop us a line
                  </p>
                  <h2
                    className="mb-8"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "var(--c-ink)",
                      lineHeight: 1.2,
                    }}
                  >
                    Send a Message
                  </h2>

                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="flex flex-col gap-5"
                  >
                    <FieldShell delay={0.35}>
                      <FormField
                        id="name"
                        label="Full Name"
                        {...register("name", { required: "Name is required" })}
                        error={errors.name?.message}
                      />
                    </FieldShell>

                    <FieldShell delay={0.42}>
                      <FormField
                        id="email"
                        label="Email Address"
                        type="email"
                        {...register("email", {
                          required: "Email is required",
                          pattern: {
                            value: /\S+@\S+\.\S+/,
                            message: "Invalid email address",
                          },
                        })}
                        error={errors.email?.message}
                      />
                    </FieldShell>

                    <FieldShell delay={0.49}>
                      <FormField
                        id="subject"
                        label="Subject"
                        {...register("subject", {
                          required: "Subject is required",
                        })}
                        error={errors.subject?.message}
                      />
                    </FieldShell>

                    <FieldShell delay={0.56}>
                      <FormField
                        id="message"
                        label="Message"
                        type="textarea"
                        className="h-32 resize-none"
                        {...register("message", {
                          required: "Message is required",
                        })}
                        error={errors.message?.message}
                      />
                    </FieldShell>

                    <motion.div
                      className="flex flex-wrap items-center gap-4 pt-1"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.68 }}
                    >
                      <SubmitButton loading={loading}>
                        Send Message
                      </SubmitButton>

                      {/* ── Success banner ── */}
                      {success && (
                        <motion.div
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                          style={{
                            background: "var(--c-sage-l)",
                            borderColor: "#6ee7b7",
                          }}
                          initial={{ opacity: 0, scale: 0.85, x: 8 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 260 }}
                        >
                          <motion.span
                            className="text-green-500 font-bold"
                            animate={{ rotate: [0, -12, 12, 0] }}
                            transition={{ duration: 0.5 }}
                          >
                            ✓
                          </motion.span>
                          <span className="text-xs font-bold text-green-700 uppercase tracking-widest">
                            Message Sent!
                          </span>
                        </motion.div>
                      )}

                      {/* ── Error banner ── */}
                      {error && (
                        <motion.div
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                          style={{
                            background: "#fef2f2",
                            borderColor: "#fca5a5",
                          }}
                          initial={{ opacity: 0, scale: 0.85, x: 8 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 260 }}
                        >
                          <span className="text-red-500 font-bold">✕</span>
                          <span className="text-xs font-bold text-red-700 uppercase tracking-widest">
                            {error}
                          </span>
                        </motion.div>
                      )}
                    </motion.div>
                  </form>

                  {/* Trust badges */}
                  <motion.div
                    className="flex flex-wrap items-center gap-5 mt-8 pt-6"
                    style={{ borderTop: "1px solid var(--c-border)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.88 }}
                  >
                    <TrustBadge icon={Shield} label="Secure" />
                    <TrustBadge icon={Zap} label="Fast Reply" />
                    <TrustBadge icon={Users} label="Trusted" />
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default ContactPage;
