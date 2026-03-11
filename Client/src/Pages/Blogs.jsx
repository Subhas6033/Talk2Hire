import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Clock,
  ArrowRight,
  BookOpen,
  Tag,
  X,
  Star,
  Eye,
  Heart,
  Bookmark,
  Share2,
  ArrowLeft,
  Calendar,
  Zap,
  Check,
} from "lucide-react";
import { usePublicBlog } from "../Hooks/useBlogHook";

// Design Tokens
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
  :root {
    --c-cream:#faf9f7;--c-white:#ffffff;--c-ink:#0d0d12;
    --c-ink-70:rgba(13,13,18,0.70);--c-ink-40:rgba(13,13,18,0.40);--c-ink-12:rgba(13,13,18,0.08);
    --c-slate:#1e2235;--c-slate-2:#2d3352;--c-slate-3:#3d4570;
    --c-amber:#d97706;--c-amber-l:#fef3c7;--c-amber-2:#f59e0b;--c-amber-3:#fde68a;
    --c-sage:#059669;--c-sage-l:#d1fae5;
    --c-violet:#7c3aed;--c-violet-l:#ede9fe;
    --c-rose:#e11d48;--c-rose-l:#ffe4e6;
    --c-sky:#0284c7;--c-sky-l:#e0f2fe;
    --c-border:rgba(13,13,18,0.09);
    --sh-sm:0 1px 3px rgba(13,13,18,.07),0 1px 2px rgba(13,13,18,.05);
    --sh-md:0 4px 18px rgba(13,13,18,.08),0 2px 6px rgba(13,13,18,.05);
    --sh-lg:0 20px 60px rgba(13,13,18,.11),0 8px 20px rgba(13,13,18,.07);
  }

  /* ── Base ── */
  .blog-root{font-family:'DM Sans',sans-serif;color:var(--c-ink);}
  .blog-root h1,.blog-root h2,.blog-root h3,.blog-root h4{font-family:'Playfair Display',Georgia,serif;}

  /* ══════════════════════════════════════
     BLOG BODY — covers both HTML (rich
     text editor) and rendered Markdown
  ══════════════════════════════════════ */

  /* Headings */
  .blog-body h1{font-size:clamp(1.75rem,3vw,2.25rem);font-weight:900;line-height:1.15;margin:2.5rem 0 1rem;color:var(--c-ink);font-family:'Playfair Display',serif;letter-spacing:-0.02em;}
  .blog-body h2{font-size:clamp(1.35rem,2.5vw,1.75rem);font-weight:700;line-height:1.25;margin:2.25rem 0 0.875rem;color:var(--c-ink);font-family:'Playfair Display',serif;letter-spacing:-0.01em;}
  .blog-body h3{font-size:1.2rem;font-weight:700;line-height:1.35;margin:1.75rem 0 0.625rem;color:var(--c-ink);font-family:'Playfair Display',serif;}
  .blog-body h4{font-size:1.05rem;font-weight:700;line-height:1.4;margin:1.5rem 0 0.5rem;color:var(--c-ink);}
  .blog-body h5{font-size:0.95rem;font-weight:700;line-height:1.4;margin:1.25rem 0 0.4rem;color:var(--c-ink-70);}
  .blog-body h6{font-size:0.875rem;font-weight:700;line-height:1.4;margin:1rem 0 0.35rem;color:var(--c-ink-40);text-transform:uppercase;letter-spacing:0.06em;}

  /* Heading anchors (markdown auto-generated) */
  .blog-body h1 a,.blog-body h2 a,.blog-body h3 a,.blog-body h4 a{color:inherit;text-decoration:none;}
  .blog-body h2:not(:first-child){padding-top:0.5rem;border-top:1px solid var(--c-border);}

  /* Paragraph & lead */
  .blog-body p{margin-bottom:1.35rem;line-height:1.9;color:var(--c-ink-70);font-size:1rem;}
  .blog-body p:first-of-type{font-size:1.065rem;color:var(--c-ink-70);}
  .blog-body p:last-child{margin-bottom:0;}

  /* Lists */
  .blog-body ul{margin:0 0 1.35rem 1.75rem;list-style:disc;}
  .blog-body ol{margin:0 0 1.35rem 1.75rem;list-style:decimal;}
  .blog-body ul ul{list-style:circle;margin-top:0.4rem;margin-bottom:0.4rem;}
  .blog-body ul ul ul{list-style:square;}
  .blog-body ol ol{list-style:lower-alpha;margin-top:0.4rem;margin-bottom:0.4rem;}
  .blog-body li{margin-bottom:0.5rem;line-height:1.8;color:var(--c-ink-70);padding-left:0.25rem;}
  .blog-body li > p{margin-bottom:0.5rem;}
  .blog-body li::marker{color:var(--c-amber);font-weight:700;}

  /* Task lists (GFM) */
  .blog-body input[type="checkbox"]{accent-color:var(--c-amber);margin-right:0.5rem;width:1rem;height:1rem;vertical-align:middle;cursor:default;}
  .blog-body li:has(input[type="checkbox"]){list-style:none;margin-left:-1.25rem;}

  /* Inline formatting */
  .blog-body strong{font-weight:700;color:inherit;}
  .blog-body em{font-style:italic;color:inherit;}
  .blog-body strong em,.blog-body em strong{font-weight:700;font-style:italic;color:inherit;}
  .blog-body u{text-decoration:underline;text-underline-offset:3px;color:inherit;}
  .blog-body s,.blog-body del{text-decoration:line-through;color:var(--c-ink-40);}
  .blog-body mark{background-color:#fef08a;color:var(--c-ink);padding:0.1em 0.25em;border-radius:3px;}
  .blog-body sub{font-size:0.75em;vertical-align:sub;}
  .blog-body sup{font-size:0.75em;vertical-align:super;}

  /* Inline spans — must NOT override editor-injected style attributes */
  .blog-body span{color:inherit;background-color:inherit;}

  /* Links */
  .blog-body a{color:var(--c-sky);text-decoration:underline;text-underline-offset:3px;font-weight:500;transition:color 0.15s,opacity 0.15s;cursor:pointer;word-break:break-word;}
  .blog-body a:hover{color:var(--c-slate);opacity:0.85;}
  .blog-body a:visited{color:var(--c-violet);}
  .blog-body a[target="_blank"]::after{content:" ↗";font-size:0.7em;opacity:0.6;vertical-align:super;}

  /* Blockquote */
  .blog-body blockquote{border-left:3px solid var(--c-amber);margin:1.75rem 0;padding:0.875rem 1.375rem;background:var(--c-amber-l);border-radius:0 14px 14px 0;font-style:italic;color:var(--c-ink-70);position:relative;}
  .blog-body blockquote p{margin-bottom:0;color:inherit;}
  .blog-body blockquote p:not(:last-child){margin-bottom:0.75rem;}
  .blog-body blockquote cite{display:block;margin-top:0.75rem;font-size:0.875rem;font-style:normal;font-weight:600;color:var(--c-amber);opacity:0.8;}
  .blog-body blockquote blockquote{margin:0.75rem 0 0;background:rgba(217,119,6,0.08);}

  /* Inline code */
  .blog-body code{background:var(--c-ink-12);padding:0.2em 0.45em;border-radius:6px;font-size:0.875em;font-family:ui-monospace,SFMono-Regular,'Cascadia Code',monospace;color:var(--c-violet);border:1px solid var(--c-border);white-space:nowrap;}

  /* Code blocks */
  .blog-body pre{background:var(--c-slate);color:#e2e8f0;padding:1.375rem 1.625rem;border-radius:16px;overflow-x:auto;margin:1.5rem 0;font-size:0.875rem;line-height:1.75;border:1px solid rgba(255,255,255,0.06);box-shadow:var(--sh-md);}
  .blog-body pre code{background:none;padding:0;border:none;color:inherit;font-size:inherit;white-space:pre;border-radius:0;}

  /* Code block with language label */
  .blog-body pre[data-language]::before{content:attr(data-language);display:block;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.35);margin-bottom:0.875rem;padding-bottom:0.5rem;border-bottom:1px solid rgba(255,255,255,0.08);}

  /* Horizontal rule */
  .blog-body hr{border:none;height:1px;background:linear-gradient(90deg,transparent,var(--c-border),transparent);margin:2.5rem 0;}

  /* Images */
  .blog-body img{max-width:100%;height:auto;border-radius:14px;margin:1.5rem auto;display:block;box-shadow:var(--sh-md);}
  .blog-body figure{margin:1.75rem 0;text-align:center;}
  .blog-body figcaption{font-size:0.8rem;color:var(--c-ink-40);margin-top:0.625rem;font-style:italic;text-align:center;}

  /* Tables */
  .blog-body table{width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:0.9rem;border-radius:12px;overflow:hidden;box-shadow:var(--sh-sm);}
  .blog-body thead{background:var(--c-slate);color:#fff;}
  .blog-body th{font-weight:700;padding:0.75rem 1.125rem;text-align:left;color:#fff;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;}
  .blog-body td{padding:0.75rem 1.125rem;border-bottom:1px solid var(--c-border);color:var(--c-ink-70);vertical-align:top;}
  .blog-body tbody tr:last-child td{border-bottom:none;}
  .blog-body tbody tr:nth-child(even){background:rgba(13,13,18,0.025);}
  .blog-body tbody tr:hover{background:var(--c-amber-l);transition:background 0.15s;}

  /* Definition lists */
  .blog-body dl{margin:0 0 1.35rem;}
  .blog-body dt{font-weight:700;color:var(--c-ink);margin-top:1rem;}
  .blog-body dd{margin-left:1.5rem;color:var(--c-ink-70);line-height:1.8;}

  /* Abbreviations */
  .blog-body abbr[title]{text-decoration:underline dotted;cursor:help;text-underline-offset:3px;}

  /* Keyboard keys */
  .blog-body kbd{display:inline-block;padding:0.15em 0.5em;font-size:0.8em;font-family:ui-monospace,monospace;background:var(--c-white);border:1px solid var(--c-border);border-bottom-width:2px;border-radius:5px;color:var(--c-ink);box-shadow:0 1px 0 var(--c-border);}

  /* Details / Summary (collapsible) */
  .blog-body details{border:1px solid var(--c-border);border-radius:12px;padding:0.75rem 1.25rem;margin-bottom:1.25rem;background:var(--c-cream);}
  .blog-body summary{font-weight:600;cursor:pointer;color:var(--c-ink);list-style:none;display:flex;align-items:center;gap:0.5rem;}
  .blog-body summary::before{content:"▶";font-size:0.65rem;color:var(--c-amber);transition:transform 0.2s;}
  .blog-body details[open] summary::before{transform:rotate(90deg);}
  .blog-body details[open] summary{margin-bottom:0.75rem;}

  /* Footnotes (markdown-it / remark) */
  .blog-body .footnotes{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--c-border);font-size:0.85rem;color:var(--c-ink-40);}
  .blog-body .footnotes ol{margin-left:1.25rem;}
  .blog-body .footnotes li{margin-bottom:0.25rem;}
  .blog-body sup a[href^="#fn"]{color:var(--c-amber);text-decoration:none;font-weight:700;font-size:0.75em;}

  /* Callout / admonition blocks (common in MDX / Notion exports) */
  .blog-body .callout,.blog-body .admonition{border-radius:14px;padding:1rem 1.25rem;margin:1.5rem 0;display:flex;gap:0.875rem;align-items:flex-start;border:1px solid var(--c-border);}
  .blog-body .callout-info,.blog-body .admonition-note{background:var(--c-sky-l);border-color:var(--c-sky);}
  .blog-body .callout-warning,.blog-body .admonition-warning{background:var(--c-amber-l);border-color:var(--c-amber);}
  .blog-body .callout-danger,.blog-body .admonition-danger{background:var(--c-rose-l);border-color:var(--c-rose);}
  .blog-body .callout-success,.blog-body .admonition-tip{background:var(--c-sage-l);border-color:var(--c-sage);}

  /* Utility */
  .line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .line-clamp-3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .search-input::placeholder{color:var(--c-ink-40);}
  .search-input:focus{outline:none;}
`;

// Categoy Config
const CATEGORIES = [
  {
    id: "all",
    label: "All Posts",
    color: "var(--c-slate)",
    bg: "var(--c-ink-12)",
  },
  {
    id: "interview",
    label: "Interview Tips",
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
  },
  {
    id: "career",
    label: "Career Growth",
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
  },
  {
    id: "ai",
    label: "AI & Tech",
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
  },
  {
    id: "salary",
    label: "Salary & Offers",
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
  },
  {
    id: "resume",
    label: "Resume & Profile",
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
  },
];

const CATEGORY_STYLE = {
  interview: {
    gradient: "linear-gradient(135deg,#ffe4e6 0%,#fecdd3 100%)",
    iconColor: "var(--c-rose)",
  },
  career: {
    gradient: "linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%)",
    iconColor: "var(--c-sage)",
  },
  ai: {
    gradient: "linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)",
    iconColor: "var(--c-violet)",
  },
  salary: {
    gradient: "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)",
    iconColor: "var(--c-amber)",
  },
  resume: {
    gradient: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%)",
    iconColor: "var(--c-sky)",
  },
  default: {
    gradient: "linear-gradient(135deg,#faf9f7 0%,#e5e7eb 100%)",
    iconColor: "var(--c-ink-40)",
  },
};

const getCategoryStyle = (cat) => CATEGORY_STYLE[cat] || CATEGORY_STYLE.default;
const AVATAR_COLORS = [
  "#10b981",
  "#f59e0b",
  "#6366f1",
  "#0ea5e9",
  "#ec4899",
  "#8b5cf6",
];
const avatarColor = (name = "") =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

// Shared primitives
const GridTexture = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage:
        "linear-gradient(var(--c-border) 1px,transparent 1px),linear-gradient(90deg,var(--c-border) 1px,transparent 1px)",
      backgroundSize: "52px 52px",
      opacity: 0.38,
    }}
  />
);
const CornerGlow = () => (
  <>
    <div
      className="absolute top-0 right-0 w-125 h-125 rounded-full pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 80% 15%,#fef3c7 0%,#fde68a 25%,transparent 65%)",
        opacity: 0.55,
        filter: "blur(80px)",
      }}
    />
    <div
      className="absolute top-1/2 left-0 w-87.5 h-87.5 rounded-full pointer-events-none"
      style={{
        background: "radial-gradient(circle,#ede9fe 0%,transparent 70%)",
        opacity: 0.28,
        filter: "blur(90px)",
      }}
    />
  </>
);
const CategoryPill = ({ cat, active, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.96 }}
    className="px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest cursor-pointer shrink-0 transition-all duration-200"
    style={{
      background: active ? cat.color : "var(--c-white)",
      borderColor: active ? cat.color : "var(--c-border)",
      color: active ? "#fff" : "var(--c-ink-70)",
      boxShadow: active ? "var(--sh-md)" : "var(--sh-sm)",
    }}
  >
    {cat.label}
  </motion.button>
);
const ReadingTime = ({ time }) => (
  <span
    className="flex items-center gap-1 text-[11px]"
    style={{ color: "var(--c-ink-40)" }}
  >
    <Clock size={10} /> {time ? `${time} min read` : "—"}
  </span>
);
const ViewCount = ({ views }) => (
  <span
    className="flex items-center gap-1 text-[11px]"
    style={{ color: "var(--c-ink-40)" }}
  >
    <Eye size={10} /> {views ?? 0}
  </span>
);
const PostSkeleton = () => (
  <div
    className="rounded-3xl border overflow-hidden animate-pulse"
    style={{ background: "var(--c-white)", borderColor: "var(--c-border)" }}
  >
    <div className="h-24" style={{ background: "var(--c-ink-12)" }} />
    <div className="p-6 space-y-3">
      <div
        className="h-4 rounded-full w-3/4"
        style={{ background: "var(--c-ink-12)" }}
      />
      <div
        className="h-4 rounded-full w-full"
        style={{ background: "var(--c-ink-12)" }}
      />
      <div
        className="h-4 rounded-full w-5/6"
        style={{ background: "var(--c-ink-12)" }}
      />
    </div>
  </div>
);

// Share Button
function ShareButton({ slug, title }) {
  const [state, setState] = useState("idle"); // "idle" | "open" | "copied"
  const popupRef = useRef(null);
  const url = `${window.location.origin}/blog/${slug}`;

  // Close on outside click
  useEffect(() => {
    if (state !== "open") return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setState("idle");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [state]);

  const handleShare = async () => {
    // Mobile: native share sheet
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled → show popup
      }
    }
    setState("open");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      window.prompt("Copy this link:", url);
      setState("idle");
    }
  };

  const shareVia = (platform) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const links = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    };
    window.open(
      links[platform],
      "_blank",
      "noopener,noreferrer,width=600,height=500",
    );
    setState("idle");
  };

  return (
    <div className="relative" ref={popupRef}>
      {/* Trigger button */}
      <motion.button
        onClick={handleShare}
        whileTap={{ scale: 0.88 }}
        title="Share article"
        className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all"
        style={{
          background: state === "copied" ? "var(--c-sage-l)" : "var(--c-white)",
          borderColor: state === "copied" ? "var(--c-sage)" : "var(--c-border)",
          color: state === "copied" ? "var(--c-sage)" : "var(--c-ink-40)",
        }}
      >
        {state === "copied" ? <Check size={14} /> : <Share2 size={15} />}
      </motion.button>

      {/* Share Popup */}
      <AnimatePresence>
        {state === "open" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-12 z-50 w-72 rounded-2xl border overflow-hidden"
            style={{
              background: "var(--c-white)",
              borderColor: "var(--c-border)",
              boxShadow: "var(--sh-lg)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--c-border)" }}
            >
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--c-ink)" }}
              >
                Share Article
              </span>
              <motion.button
                onClick={() => setState("idle")}
                whileTap={{ scale: 0.9 }}
                className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer"
                style={{
                  background: "var(--c-ink-12)",
                  color: "var(--c-ink-70)",
                }}
              >
                <X size={12} />
              </motion.button>
            </div>

            {/* Social share buttons */}
            <div className="p-3 grid grid-cols-3 gap-2">
              {[
                {
                  id: "twitter",
                  label: "Twitter / X",
                  bg: "#000",
                  color: "#fff",
                  icon: (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  ),
                },
                {
                  id: "linkedin",
                  label: "LinkedIn",
                  bg: "#0A66C2",
                  color: "#fff",
                  icon: (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  ),
                },
                {
                  id: "whatsapp",
                  label: "WhatsApp",
                  bg: "#25D366",
                  color: "#fff",
                  icon: (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                    </svg>
                  ),
                },
              ].map((s) => (
                <motion.button
                  key={s.id}
                  onClick={() => shareVia(s.id)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.94 }}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl cursor-pointer"
                  style={{
                    background: `${s.bg}12`,
                    border: `1px solid ${s.bg}22`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.icon}
                  </div>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: "var(--c-ink-70)" }}
                  >
                    {s.label}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Copy link row */}
            <div
              className="mx-3 mb-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border"
              style={{
                background: "var(--c-cream)",
                borderColor: "var(--c-border)",
              }}
            >
              <span
                className="flex-1 text-xs truncate font-mono"
                style={{ color: "var(--c-ink-70)" }}
              >
                {url}
              </span>
              <motion.button
                onClick={copyLink}
                whileTap={{ scale: 0.92 }}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                style={{
                  background: "var(--c-slate)",
                  color: "#fff",
                }}
              >
                Copy
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Post Card
const FeaturedCard = ({ post, onRead }) => {
  const cat = CATEGORIES.find((c) => c.id === post.category);
  const { gradient } = getCategoryStyle(post.category);
  const color = avatarColor(post.author_name);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      onClick={() => onRead(post)}
      className="group relative overflow-hidden rounded-3xl border cursor-pointer"
      style={{
        background: "var(--c-white)",
        borderColor: "var(--c-border)",
        boxShadow: "var(--sh-lg)",
      }}
    >
      <div
        className="h-48 sm:h-56 relative overflow-hidden"
        style={{ background: post.cover_image ? undefined : gradient }}
      >
        {post.cover_image ? (
          <img
            src={post.cover_image}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle,rgba(0,0,0,0.06) 1px,transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        )}
        <div
          className="absolute top-5 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            boxShadow: "var(--sh-sm)",
          }}
        >
          <Star size={10} className="fill-amber-400 text-amber-400" />
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--c-ink)" }}
          >
            Featured
          </span>
        </div>
      </div>
      <div className="p-7">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
            style={{ background: cat?.bg, color: cat?.color }}
          >
            {cat?.label ?? post.category}
          </span>
          <ReadingTime time={post.read_time} />
          <ViewCount views={post.views} />
        </div>
        <h2
          className="text-xl sm:text-2xl font-bold leading-snug mb-3 line-clamp-2"
          style={{ color: "var(--c-ink)" }}
        >
          {post.title}
        </h2>
        <p
          className="text-sm leading-relaxed mb-5 line-clamp-2"
          style={{ color: "var(--c-ink-70)" }}
        >
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: color }}
            >
              {(post.author_name ?? "A")[0]}
            </div>
            <div>
              <p
                className="text-xs font-bold"
                style={{ color: "var(--c-ink)" }}
              >
                {post.author_name ?? "Author"}
              </p>
              <p className="text-[10px]" style={{ color: "var(--c-ink-40)" }}>
                {fmtDate(post.published_at)}
              </p>
            </div>
          </div>
          <motion.div
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl"
            style={{ background: "var(--c-slate)", color: "#fff" }}
            whileHover={{ gap: "0.5rem" }}
          >
            Read Article <ArrowRight size={13} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

// Regular Post Card
const PostCard = ({ post, index, onRead }) => {
  const cat = CATEGORIES.find((c) => c.id === post.category);
  const { gradient, iconColor } = getCategoryStyle(post.category);
  const color = avatarColor(post.author_name);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{
        delay: index * 0.08,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -6, boxShadow: "var(--sh-lg)" }}
      onClick={() => onRead(post)}
      className="group relative overflow-hidden rounded-3xl border cursor-pointer flex flex-col"
      style={{
        background: "var(--c-white)",
        borderColor: "var(--c-border)",
        boxShadow: "var(--sh-sm)",
        transition: "box-shadow 0.3s",
      }}
    >
      <div
        className="h-24 relative overflow-hidden flex items-center justify-between px-6"
        style={{ background: post.cover_image ? undefined : gradient }}
      >
        {post.cover_image ? (
          <img
            src={post.cover_image}
            alt={post.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle,rgba(0,0,0,0.05) 1px,transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />
        )}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center border relative z-10"
          style={{
            background: "rgba(255,255,255,0.8)",
            borderColor: "rgba(255,255,255,0.5)",
          }}
        >
          <BookOpen size={18} style={{ color: iconColor }} />
        </div>
        <span
          className="relative z-10 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.85)", color: cat?.color }}
        >
          {cat?.label ?? post.category}
        </span>
      </div>
      <div className="p-6 flex flex-col flex-1">
        <h3
          className="font-bold text-base leading-snug mb-2.5 line-clamp-2"
          style={{ color: "var(--c-ink)" }}
        >
          {post.title}
        </h3>
        <p
          className="text-sm leading-relaxed mb-4 line-clamp-3 flex-1"
          style={{ color: "var(--c-ink-70)" }}
        >
          {post.excerpt}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(post.tags ?? []).slice(0, 2).map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold"
              style={{
                background: "var(--c-cream)",
                color: "var(--c-ink-70)",
                border: "1px solid var(--c-border)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <div
          className="flex items-center justify-between pt-4 border-t"
          style={{ borderColor: "var(--c-border)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
              style={{ backgroundColor: color }}
            >
              {(post.author_name ?? "A")[0]}
            </div>
            <div>
              <p
                className="text-[11px] font-semibold leading-none"
                style={{ color: "var(--c-ink)" }}
              >
                {post.author_name ?? "Author"}
              </p>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: "var(--c-ink-40)" }}
              >
                {fmtDate(post.published_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ReadingTime time={post.read_time} />
            <ViewCount views={post.views} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Article Reader (Read inside /blog/:slug)
const ArticleSEO = ({ post }) => {
  const url = `https://talk2hire.com/blog/${post.slug}`;
  const image = post.cover_image ?? "https://talk2hire.com/og-blog.png";

  useEffect(() => {
    document.title = `${post.title} | Talk2Hire Blog`;
    return () => {
      document.title =
        "Blog | Talk2Hire — Career Tips, Interview Prep & Hiring Insights";
    };
  }, [post.title]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url,
    datePublished: post.published_at,
    dateModified: post.updated_at ?? post.published_at,
    image,
    inLanguage: "en-US",
    keywords: (post.tags ?? []).join(", "),
    articleSection: post.category,
    timeRequired: post.read_time ? `PT${post.read_time}M` : undefined,
    author: {
      "@type": "Person",
      name: post.author_name ?? "Talk2Hire Team",
      url: post.author_username
        ? `https://talk2hire.com/authors/${post.author_username}`
        : "https://talk2hire.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Talk2Hire",
      url: "https://talk2hire.com",
      logo: { "@type": "ImageObject", url: "https://talk2hire.com/logo.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://talk2hire.com",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: "https://talk2hire.com/blog",
        },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  };

  return (
    <>
      <meta name="description" content={post.excerpt} />
      <link rel="canonical" href={url} />
      <meta
        name="robots"
        content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
      />
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="Talk2Hire" />
      <meta property="og:title" content={post.title} />
      <meta property="og:description" content={post.excerpt} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={post.title} />
      <meta property="article:published_time" content={post.published_at} />
      <meta
        property="article:modified_time"
        content={post.updated_at ?? post.published_at}
      />
      <meta
        property="article:author"
        content={post.author_name ?? "Talk2Hire Team"}
      />
      <meta property="article:section" content={post.category} />
      {(post.tags ?? []).map((t) => (
        <meta key={t} property="article:tag" content={t} />
      ))}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@talk2hire" />
      <meta name="twitter:title" content={post.title} />
      <meta name="twitter:description" content={post.excerpt} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={post.title} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
};

// Article Reader
const ArticleReader = ({ post, onBack, relatedPosts }) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const cat = CATEGORIES.find((c) => c.id === post.category);
  const { gradient, iconColor } = getCategoryStyle(post.category);
  const color = avatarColor(post.author_name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen"
      style={{ background: "var(--c-white)" }}
    >
      {/* ── SEO ── */}
      <ArticleSEO post={post} />
      {/* Reading progress bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-0.5"
        style={{ background: "var(--c-border)" }}
      >
        <motion.div
          className="h-full"
          style={{
            background:
              "linear-gradient(90deg,var(--c-amber),var(--c-amber-2))",
          }}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 45, ease: "linear" }}
        />
      </div>

      {/* Sticky nav */}
      <div
        className="sticky top-0 z-40 border-b"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          borderColor: "var(--c-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <motion.button
            onClick={onBack}
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer"
            style={{ color: "var(--c-ink-70)" }}
          >
            <ArrowLeft size={16} /> Back to Blog
          </motion.button>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setLiked(!liked)}
              whileTap={{ scale: 0.88 }}
              className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all"
              style={{
                background: liked ? "var(--c-rose-l)" : "var(--c-white)",
                borderColor: liked ? "var(--c-rose)" : "var(--c-border)",
                color: liked ? "var(--c-rose)" : "var(--c-ink-40)",
              }}
            >
              <Heart size={15} fill={liked ? "currentColor" : "none"} />
            </motion.button>
            <motion.button
              onClick={() => setBookmarked(!bookmarked)}
              whileTap={{ scale: 0.88 }}
              className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all"
              style={{
                background: bookmarked ? "var(--c-amber-l)" : "var(--c-white)",
                borderColor: bookmarked ? "var(--c-amber)" : "var(--c-border)",
                color: bookmarked ? "var(--c-amber)" : "var(--c-ink-40)",
              }}
            >
              <Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} />
            </motion.button>
            {/* Functional share button */}
            <ShareButton slug={post.slug} title={post.title} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest mb-6"
              style={{ background: cat?.bg, color: cat?.color }}
            >
              <Tag size={10} /> {cat?.label ?? post.category}
            </span>
          </motion.div>
          <motion.h1
            className="leading-[1.1] tracking-tight mb-6"
            style={{
              fontSize: "clamp(28px,4.5vw,48px)",
              fontWeight: 900,
              color: "var(--c-ink)",
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.15,
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {post.title}
          </motion.h1>
          <motion.p
            className="text-lg leading-relaxed mb-8"
            style={{ color: "var(--c-ink-70)", fontWeight: 300 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            {post.excerpt}
          </motion.p>
          <motion.div
            className="flex flex-wrap items-center gap-5 py-5 border-y"
            style={{ borderColor: "var(--c-border)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: color }}
              >
                {(post.author_name ?? "A")[0]}
              </div>
              <div>
                <p
                  className="text-sm font-bold"
                  style={{ color: "var(--c-ink)" }}
                >
                  {post.author_name ?? "Author"}
                </p>
                <p className="text-xs" style={{ color: "var(--c-ink-40)" }}>
                  {post.author_username ? `@${post.author_username}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--c-ink-40)" }}
              >
                <Calendar size={11} />
                {fmtDate(post.published_at)}
              </span>
              <ReadingTime time={post.read_time} />
              <ViewCount views={post.views} />
            </div>
          </motion.div>
        </div>

        {/* Cover image */}
        <motion.div
          className="rounded-3xl overflow-hidden mb-14 relative flex items-center justify-center"
          style={{
            background: post.cover_image ? undefined : gradient,
            height: "240px",
          }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          {post.cover_image ? (
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(circle,rgba(0,0,0,0.05) 1px,transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center border relative z-10"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  borderColor: "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(10px)",
                  boxShadow: "var(--sh-lg)",
                }}
              >
                <BookOpen size={38} style={{ color: iconColor }} />
              </div>
            </>
          )}
        </motion.div>

        {/* Body */}
        <motion.div
          className="blog-body text-base"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        <div
          className="flex flex-wrap gap-2 mt-12 pt-8 border-t"
          style={{ borderColor: "var(--c-border)" }}
        >
          {(post.tags ?? []).map((t) => (
            <span
              key={t}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold"
              style={{
                background: "var(--c-cream)",
                borderColor: "var(--c-border)",
                color: "var(--c-ink-70)",
              }}
            >
              <Tag size={10} /> {t}
            </span>
          ))}
        </div>

        {/* Author card */}
        <motion.div
          className="mt-10 p-7 rounded-3xl border"
          style={{
            background: "var(--c-cream)",
            borderColor: "var(--c-border)",
            boxShadow: "var(--sh-sm)",
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold"
              style={{ backgroundColor: color }}
            >
              {(post.author_name ?? "A")[0]}
            </div>
            <div>
              <p className="font-bold" style={{ color: "var(--c-ink)" }}>
                {post.author_name ?? "Author"}
              </p>
              <p className="text-sm" style={{ color: "var(--c-ink-40)" }}>
                {post.author_username ? `@${post.author_username}` : ""}
              </p>
            </div>
          </div>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--c-ink-70)" }}
          >
            A seasoned professional sharing real-world insights to help
            candidates navigate the modern job market with confidence.
          </p>
        </motion.div>

        {/* Related posts — clicking navigates to that slug URL */}
        {relatedPosts.length > 0 && (
          <div className="mt-16">
            <h3
              className="text-2xl font-bold mb-6"
              style={{ color: "var(--c-ink)" }}
            >
              Related Articles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {relatedPosts.map((rp, i) => {
                const rc = CATEGORIES.find((c) => c.id === rp.category);
                return (
                  <motion.div
                    key={rp.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 + i * 0.08 }}
                    whileHover={{ y: -4 }}
                    onClick={() => navigate(`/blog/${rp.slug}`)}
                    className="p-5 rounded-2xl border cursor-pointer"
                    style={{
                      background: "var(--c-white)",
                      borderColor: "var(--c-border)",
                      boxShadow: "var(--sh-sm)",
                    }}
                  >
                    <span
                      className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-3"
                      style={{ background: rc?.bg, color: rc?.color }}
                    >
                      {rc?.label ?? rp.category}
                    </span>
                    <h4
                      className="font-bold text-sm leading-snug mb-2 line-clamp-2"
                      style={{ color: "var(--c-ink)" }}
                    >
                      {rp.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <ReadingTime time={rp.read_time} />
                      <ViewCount views={rp.views} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// All the blog lists
const BlogList = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { posts, loading } = usePublicBlog({
    category: activeCategory !== "all" ? activeCategory : undefined,
    search: searchQuery || undefined,
    sortBy: "publishedAt",
  });

  const featured = posts[0] ?? null;
  const rest = posts.slice(1);

  // Clicking any card navigates to /blog/:slug
  const handleRead = (post) => navigate(`/blog/${post.slug}`);

  return (
    <motion.div
      key="listing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* HERO */}
      <section
        className="relative overflow-hidden py-24"
        style={{ background: "var(--c-white)" }}
      >
        <GridTexture />
        <CornerGlow />
        <div
          className="absolute top-8 right-14 w-48 h-48 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.10)" }}
        />
        <div
          className="absolute bottom-10 left-8 w-32 h-32 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.08)" }}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6"
              style={{
                background: "var(--c-amber-l)",
                borderColor: "rgba(217,119,6,0.25)",
              }}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
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
                Talk2Hire Blog
              </span>
            </motion.div>
            <motion.h1
              className="leading-[1.06] tracking-tight mb-5"
              style={{
                fontSize: "clamp(36px,5.5vw,64px)",
                fontWeight: 900,
                color: "var(--c-ink)",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.65 }}
            >
              Insights to{" "}
              <span
                style={{
                  fontStyle: "italic",
                  background:
                    "linear-gradient(135deg,var(--c-slate) 0%,var(--c-slate-3) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                land your
              </span>
              <br />
              dream role.
            </motion.h1>
            <motion.p
              className="text-base leading-relaxed mb-8 max-w-md"
              style={{ color: "var(--c-ink-70)", fontWeight: 300 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Expert advice on interviews, salaries, career growth, and the
              future of hiring — from real professionals.
            </motion.p>
            <motion.div
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border max-w-md"
              style={{
                background: "var(--c-white)",
                borderColor: "var(--c-border)",
                boxShadow: "var(--sh-md)",
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileFocusWithin={{
                borderColor: "var(--c-amber)",
                boxShadow: "0 0 0 3px rgba(217,119,6,0.10),var(--sh-md)",
              }}
            >
              <Search
                size={16}
                style={{ color: "var(--c-ink-40)", flexShrink: 0 }}
              />
              <input
                className="search-input flex-1 bg-transparent text-sm"
                style={{
                  color: "var(--c-ink)",
                  fontFamily: "'DM Sans',sans-serif",
                }}
                placeholder="Search articles, topics, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <motion.button
                  onClick={() => setSearchQuery("")}
                  whileTap={{ scale: 0.9 }}
                  className="cursor-pointer"
                  style={{ color: "var(--c-ink-40)" }}
                >
                  <X size={14} />
                </motion.button>
              )}
            </motion.div>
          </div>
          <motion.div
            className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t"
            style={{ borderColor: "var(--c-border)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[
              { value: `${posts.length}+`, label: "Articles" },
              { value: "6", label: "Categories" },
              { value: "50k+", label: "Monthly readers" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span
                  className="text-lg font-black"
                  style={{
                    fontFamily: "'Playfair Display',serif",
                    color: "var(--c-ink)",
                  }}
                >
                  {s.value}
                </span>
                <span className="text-xs" style={{ color: "var(--c-ink-40)" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CATEGORY FILTER */}
      <div
        className="sticky top-0 z-30 border-b py-4"
        style={{
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(20px)",
          borderColor: "var(--c-border)",
        }}
      >
        <div className="mx-auto max-w-7xl px-6">
          <div
            className="flex items-center gap-2.5 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {CATEGORIES.map((cat) => (
              <CategoryPill
                key={cat.id}
                cat={cat}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* POSTS GRID */}
      <section
        className="py-16 relative"
        style={{ background: "var(--c-cream)" }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle,var(--c-border) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <PostSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              {activeCategory === "all" && !searchQuery && featured && (
                <div className="mb-10">
                  <div className="flex items-center gap-2 mb-5">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "var(--c-amber)" }}
                    >
                      Editor's Pick
                    </span>
                  </div>
                  <FeaturedCard post={featured} onRead={handleRead} />
                </div>
              )}
              <AnimatePresence mode="wait">
                {posts.length > 0 ? (
                  <motion.div
                    key={activeCategory + searchQuery}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {(activeCategory !== "all" || searchQuery) && (
                      <div className="flex items-center justify-between mb-6">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--c-ink-70)" }}
                        >
                          {posts.length} article{posts.length !== 1 ? "s" : ""}{" "}
                          found
                        </p>
                        {searchQuery && (
                          <span
                            className="text-xs px-3 py-1 rounded-full"
                            style={{
                              background: "var(--c-amber-l)",
                              color: "var(--c-amber)",
                            }}
                          >
                            "{searchQuery}"
                          </span>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {(activeCategory === "all" && !searchQuery
                        ? rest
                        : posts
                      ).map((post, i) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          index={i}
                          onRead={handleRead}
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-24 text-center"
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                      style={{ background: "var(--c-amber-l)" }}
                    >
                      <BookOpen size={26} style={{ color: "var(--c-amber)" }} />
                    </div>
                    <h3
                      className="text-xl font-bold mb-2"
                      style={{ color: "var(--c-ink)" }}
                    >
                      No articles found
                    </h3>
                    <p className="text-sm" style={{ color: "var(--c-ink-70)" }}>
                      Try a different search or category.
                    </p>
                    <motion.button
                      onClick={() => {
                        setSearchQuery("");
                        setActiveCategory("all");
                      }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                      style={{
                        background: "var(--c-white)",
                        borderColor: "var(--c-border)",
                        color: "var(--c-ink-70)",
                      }}
                    >
                      Clear filters
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </section>

      {/* CTA BANNER */}
      <section
        className="relative py-24 overflow-hidden"
        style={{ backgroundColor: "var(--c-slate)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle,white 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-125 h-87.5 rounded-full blur-[160px] opacity-20"
          style={{ backgroundColor: "var(--c-amber)" }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative text-center px-6"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6"
            style={{
              background: "var(--c-amber-l)",
              borderColor: "rgba(217,119,6,0.25)",
            }}
          >
            <Zap size={11} style={{ color: "var(--c-amber)" }} />
            <span
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--c-amber)" }}
            >
              Put it into practice
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight leading-[1.06]">
            Ready to ace your
            <br />
            next interview?
          </h2>
          <p className="text-white/50 mb-8 max-w-md mx-auto text-base">
            Everything you've read here — practice it for real with Talk2Hire's
            AI interview simulator.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              onClick={() => navigate("/interview")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-sm rounded-xl"
              style={{
                background: "var(--c-white)",
                color: "var(--c-slate)",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Start Practicing <ArrowRight size={14} />
            </motion.button>
            <motion.button
              onClick={() => navigate("/jobs")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-semibold text-sm rounded-xl border text-white"
              style={{
                background: "rgba(255,255,255,0.1)",
                borderColor: "rgba(255,255,255,0.2)",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Browse Jobs
            </motion.button>
          </div>
        </motion.div>
      </section>
    </motion.div>
  );
};

// Blog Post
const BlogPost = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    activePost,
    activePostLoading,
    relatedPosts,
    loadPost,
    clearActivePost,
  } = usePublicBlog();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    loadPost(slug);
    // Don't clear on unmount — let the next page or navigation handle it
  }, [slug]);

  if (activePostLoading || !activePost) {
    return (
      <>
        <title>Loading... | Talk2Hire Blog</title>
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-6 animate-pulse">
          <div
            className="h-8 w-32 rounded-full"
            style={{ background: "var(--c-ink-12)" }}
          />
          <div
            className="h-12 w-3/4 rounded-xl"
            style={{ background: "var(--c-ink-12)" }}
          />
          <div
            className="h-6 w-full rounded-xl"
            style={{ background: "var(--c-ink-12)" }}
          />
          <div
            className="h-60 rounded-3xl"
            style={{ background: "var(--c-ink-12)" }}
          />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-4 rounded-full"
              style={{
                background: "var(--c-ink-12)",
                width: `${70 + (i % 3) * 10}%`,
              }}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <ArticleReader
      post={activePost}
      onBack={() => {
        clearActivePost(); // clear only when user explicitly navigates away
        navigate("/blog");
      }}
      relatedPosts={relatedPosts}
    />
  );
};

const Blog = () => {
  const { slug } = useParams();

  const blogListJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Talk2Hire Blog",
    description:
      "Expert career advice, interview tips, salary negotiation guides, and hiring insights from the Talk2Hire team and industry professionals.",
    url: "https://talk2hire.com/blog",
    publisher: {
      "@type": "Organization",
      name: "Talk2Hire",
      url: "https://talk2hire.com",
      logo: { "@type": "ImageObject", url: "https://talk2hire.com/logo.png" },
    },
  };

  return (
    <>
      {!slug && (
        <>
          <title>
            Blog | Talk2Hire — Career Tips, Interview Prep & Hiring Insights
          </title>
          <meta
            name="description"
            content="Expert career advice, interview tips, salary negotiation guides, and hiring insights from the Talk2Hire team and industry professionals."
          />
          <link rel="canonical" href="https://talk2hire.com/blog" />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Talk2Hire" />
          <meta
            property="og:title"
            content="Blog | Talk2Hire — Career Tips, Interview Prep & Hiring Insights"
          />
          <meta
            property="og:description"
            content="Expert career advice, interview tips, salary negotiation guides, and hiring insights."
          />
          <meta property="og:url" content="https://talk2hire.com/blog" />
          <meta
            property="og:image"
            content="https://talk2hire.com/og-blog.png"
          />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@talk2hire" />
          <meta
            name="twitter:title"
            content="Blog | Talk2Hire — Career Tips, Interview Prep & Hiring Insights"
          />
          <meta
            name="twitter:description"
            content="Expert career advice, interview tips, salary negotiation guides, and hiring insights."
          />
          <meta
            name="twitter:image"
            content="https://talk2hire.com/og-blog.png"
          />
          <meta
            name="robots"
            content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
          />
          <meta name="referrer" content="origin-when-cross-origin" />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListJsonLd) }}
          />
        </>
      )}

      <style>{TOKENS}</style>
      <div className="blog-root">
        <AnimatePresence mode="wait">
          {slug ? <BlogPost key={slug} /> : <BlogList key="list" />}
        </AnimatePresence>
      </div>
    </>
  );
};

export default Blog;
