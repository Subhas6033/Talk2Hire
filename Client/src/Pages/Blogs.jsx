import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "motion/react";
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
  ChevronUp,
  List,
} from "lucide-react";
import { usePublicBlog } from "../Hooks/useBlogHook";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Fira+Code:wght@400;500&display=swap');
  :root {
    --c-cream:#faf9f7; --c-white:#ffffff; --c-ink:#0d0d12;
    --c-ink-70:rgba(13,13,18,0.70); --c-ink-40:rgba(13,13,18,0.40); --c-ink-12:rgba(13,13,18,0.08);
    --c-slate:#1e2235; --c-slate-2:#2d3352; --c-slate-3:#3d4570;
    --c-amber:#d97706; --c-amber-l:#fef3c7; --c-amber-2:#f59e0b; --c-amber-3:#fde68a;
    --c-sage:#059669; --c-sage-l:#d1fae5;
    --c-violet:#7c3aed; --c-violet-l:#ede9fe;
    --c-rose:#e11d48; --c-rose-l:#ffe4e6;
    --c-sky:#0284c7; --c-sky-l:#e0f2fe;
    --c-border:rgba(13,13,18,0.09);
    --sh-sm:0 1px 3px rgba(13,13,18,.07),0 1px 2px rgba(13,13,18,.05);
    --sh-md:0 4px 18px rgba(13,13,18,.08),0 2px 6px rgba(13,13,18,.05);
    --sh-lg:0 20px 60px rgba(13,13,18,.11),0 8px 20px rgba(13,13,18,.07);
    --sh-xl:0 32px 80px rgba(13,13,18,.14),0 12px 28px rgba(13,13,18,.08);
  }

  /* ── Base ── */
  .blog-root { font-family:'DM Sans',sans-serif; color:var(--c-ink); }
  .blog-root h1,.blog-root h2,.blog-root h3,.blog-root h4 { font-family:'Playfair Display',Georgia,serif; }

  /* ── Article root ── */
  .article-root { font-family:'DM Sans',sans-serif; color:var(--c-ink); background:var(--c-white); min-height:100vh; overflow-x:hidden; }
  .article-root h1,.article-root h2,.article-root h3,.article-root h4 { font-family:'Playfair Display',Georgia,serif; }

  /* ── Reading progress bar ── */
  .progress-bar { position:fixed; top:0; left:0; right:0; z-index:60; height:3px; background:var(--c-border); transform-origin:left; }
  .progress-fill { height:100%; background:linear-gradient(90deg,var(--c-amber),var(--c-amber-2),var(--c-amber)); background-size:200% 100%; animation:shimmer 2s linear infinite; border-radius:0 2px 2px 0; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* ── Blog body ── */
  .blog-body { font-size:1.0625rem; line-height:1.9; color:var(--c-ink-70); overflow-x:hidden; word-break:break-word; background:#fff; white-space:normal !important; font-family:'DM Sans',sans-serif !important; }
  /* CRITICAL: prevent any parent <pre> or dark block styles from leaking in */
  .blog-body p, .blog-body li, .blog-body h1, .blog-body h2, .blog-body h3, .blog-body h4,
  .blog-body ul, .blog-body ol, .blog-body blockquote, .blog-body strong, .blog-body em {
    background:transparent !important; white-space:normal !important;
    font-family:inherit; color:inherit;
  }
  .blog-body * { max-width:100%; box-sizing:border-box; }
  .blog-body h1,.blog-body h2,.blog-body h3,.blog-body h4 { font-family:'Playfair Display',serif; color:var(--c-ink); }
  .blog-body h1 { font-size:clamp(1.75rem,3vw,2.25rem); font-weight:900; line-height:1.15; margin:2.5rem 0 1rem; letter-spacing:-0.02em; }
  .blog-body h2 { font-size:clamp(1.35rem,2.5vw,1.75rem); font-weight:700; line-height:1.25; margin:2.25rem 0 0.875rem; padding-top:.5rem; border-top:1px solid var(--c-border); letter-spacing:-0.01em; }
  .blog-body h3 { font-size:1.2rem; font-weight:700; line-height:1.35; margin:1.75rem 0 0.625rem; }
  .blog-body h4 { font-size:1.05rem; font-weight:700; line-height:1.4; margin:1.5rem 0 0.5rem; }
  .blog-body p { margin:0 0 1.35rem; white-space:normal; background:transparent; color:var(--c-ink-70); font-family:'DM Sans',sans-serif; }
  .blog-body p:first-of-type { font-size:1.065rem; }
  .blog-body p:last-child { margin-bottom:0; }
  .blog-body strong { font-weight:700; color:var(--c-ink); }
  .blog-body em { font-style:italic; }
  .blog-body a { color:var(--c-sky); text-decoration:underline; text-underline-offset:3px; font-weight:500; transition:color .15s; }
  .blog-body a:hover { color:var(--c-slate); }
  .blog-body a:visited { color:var(--c-violet); }
  .blog-body ul { margin:0 0 1.35rem 1.75rem; list-style:disc; }
  .blog-body ol { margin:0 0 1.35rem 1.75rem; list-style:decimal; }
  .blog-body li { margin-bottom:.55rem; line-height:1.8; color:var(--c-ink-70); padding-left:.25rem; }
  .blog-body li::marker { color:var(--c-amber); font-weight:700; }
  .blog-body blockquote { border-left:3px solid var(--c-amber); margin:2rem 0; padding:.9rem 1.4rem; background:var(--c-amber-l); border-radius:0 14px 14px 0; font-style:italic; color:var(--c-ink-70); }
  .blog-body blockquote p { margin:0; color:inherit; }
  /* inline code — never wrap in dark block */
  .blog-body code { background:var(--c-ink-12); padding:.2em .45em; border-radius:6px; font-size:.875em; font-family:'Fira Code',ui-monospace,monospace; color:var(--c-violet); border:1px solid var(--c-border); white-space:normal; word-break:break-word; }
  /* code blocks — dark, but constrained & scrollable, never overflow parent */
  .blog-body pre { background:var(--c-slate); color:#e2e8f0; padding:1.375rem 1.625rem; border-radius:16px; overflow-x:auto; overflow-y:hidden; max-width:100%; margin:1.5rem 0; font-size:.875rem; line-height:1.75; border:1px solid rgba(255,255,255,.06); box-shadow:var(--sh-md); white-space:pre; }
  .blog-body pre code { background:none; padding:0; border:none; color:inherit; white-space:pre; border-radius:0; font-size:inherit; word-break:normal; }
  .blog-body hr { border:none; height:1px; background:linear-gradient(90deg,transparent,var(--c-border),transparent); margin:2.5rem 0; }
  .blog-body img { max-width:100%; height:auto; border-radius:14px; margin:1.5rem auto; display:block; box-shadow:var(--sh-md); }
  .blog-body table { width:100%; border-collapse:collapse; margin:1.5rem 0; font-size:.9rem; border-radius:12px; overflow:hidden; box-shadow:var(--sh-sm); display:block; overflow-x:auto; }
  .blog-body thead { background:var(--c-slate); color:#fff; }
  .blog-body th { font-weight:700; padding:.75rem 1.125rem; text-align:left; color:#fff; font-size:.8rem; text-transform:uppercase; letter-spacing:.05em; }
  .blog-body td { padding:.75rem 1.125rem; border-bottom:1px solid var(--c-border); color:var(--c-ink-70); vertical-align:top; }
  .blog-body tbody tr:last-child td { border-bottom:none; }
  .blog-body tbody tr:nth-child(even) { background:rgba(13,13,18,.025); }
  .blog-body tbody tr:hover { background:var(--c-amber-l); transition:background .15s; }
  .blog-body mark { background-color:#fef08a; color:var(--c-ink); padding:.1em .25em; border-radius:3px; }
  .blog-body s,.blog-body del { text-decoration:line-through; color:var(--c-ink-40); }

  /* ── Drop cap ── */
  .drop-cap::first-letter { font-family:'Playfair Display',serif; font-size:4.2rem; font-weight:900; float:left; line-height:.82; margin:.08em .1em 0 0; color:var(--c-ink); letter-spacing:-.02em; }

  /* ── ToC ── */
  .toc-link { display:block; padding:6px 12px; border-radius:8px; font-size:.8rem; color:var(--c-ink-70); text-decoration:none; font-weight:500; border-left:2px solid transparent; transition:all .15s; cursor:pointer; }
  .toc-link:hover,.toc-link.active { color:var(--c-amber); border-left-color:var(--c-amber); background:var(--c-amber-l); }
  .toc-link.h3 { padding-left:24px; font-size:.75rem; }

  /* ── Action buttons ── */
  .action-btn { width:38px; height:38px; border-radius:12px; border:1px solid var(--c-border); display:flex; align-items:center; justify-content:center; cursor:pointer; background:var(--c-white); color:var(--c-ink-40); transition:all .15s; }
  .action-btn:hover { border-color:var(--c-ink-40); color:var(--c-ink); }
  .action-btn.liked { background:var(--c-rose-l); border-color:var(--c-rose); color:var(--c-rose); }
  .action-btn.bookmarked { background:var(--c-amber-l); border-color:var(--c-amber); color:var(--c-amber); }
  .action-btn.shared { background:var(--c-sage-l); border-color:var(--c-sage); color:var(--c-sage); }

  /* ── Share popup ── */
  .share-popup { position:absolute; right:0; top:50px; z-index:50; width:280px; background:var(--c-white); border:1px solid var(--c-border); border-radius:20px; overflow:hidden; box-shadow:var(--sh-xl); }

  /* ── Tag pill ── */
  .tag-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:10px; border:1px solid var(--c-border); font-size:.7rem; font-weight:600; color:var(--c-ink-70); background:var(--c-cream); transition:all .15s; }
  .tag-pill:hover { border-color:var(--c-amber); color:var(--c-amber); background:var(--c-amber-l); }

  /* ── Author card ── */
  .author-card { background:linear-gradient(135deg,var(--c-cream) 0%,rgba(254,243,199,.6) 100%); border:1px solid var(--c-border); border-radius:24px; padding:2rem; box-shadow:var(--sh-sm); }

  /* ── Related card ── */
  .related-card { background:var(--c-white); border:1px solid var(--c-border); border-radius:20px; padding:1.25rem; cursor:pointer; transition:transform .25s,box-shadow .25s; }
  .related-card:hover { transform:translateY(-5px); box-shadow:var(--sh-lg); }

  /* ── Scroll top ── */
  .scroll-top { position:fixed; bottom:28px; right:28px; z-index:50; width:44px; height:44px; border-radius:14px; border:1px solid var(--c-border); background:var(--c-white); display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:var(--sh-md); color:var(--c-ink-70); transition:all .15s; }
  .scroll-top:hover { background:var(--c-slate); color:#fff; border-color:var(--c-slate); transform:translateY(-2px); }

  /* ── Hero cover ── */
  .hero-cover { width:100%; height:480px; object-fit:cover; display:block; border-radius:24px; box-shadow:var(--sh-xl); }
  .cover-placeholder { width:100%; height:480px; border-radius:24px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; box-shadow:var(--sh-xl); }

  /* ── Sidebar responsive ── */
  @media(max-width:1100px) { .sidebar-sticky { display:none !important; } }
  @media(max-width:680px) { .hero-cover,.cover-placeholder { height:280px; } }

  /* ── Blog list helpers ── */
  .line-clamp-2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .line-clamp-3 { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  .search-input::placeholder { color:var(--c-ink-40); }
  .search-input:focus { outline:none; }
`;

// ─── Constants ────────────────────────────────────────────────────────────────
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

const CAT_MAP = {
  interview: {
    label: "Interview Tips",
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
    gradient: "linear-gradient(135deg,#ffe4e6 0%,#fecdd3 100%)",
    iconColor: "var(--c-rose)",
  },
  career: {
    label: "Career Growth",
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
    gradient: "linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%)",
    iconColor: "var(--c-sage)",
  },
  ai: {
    label: "AI & Tech",
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
    gradient: "linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)",
    iconColor: "var(--c-violet)",
  },
  salary: {
    label: "Salary & Offers",
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
    gradient: "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)",
    iconColor: "var(--c-amber)",
  },
  resume: {
    label: "Resume & Profile",
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
    gradient: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%)",
    iconColor: "var(--c-sky)",
  },
  default: {
    label: "",
    color: "var(--c-ink-40)",
    bg: "var(--c-ink-12)",
    gradient: "linear-gradient(135deg,#faf9f7 0%,#e5e7eb 100%)",
    iconColor: "var(--c-ink-40)",
  },
};

const getCat = (id) => CAT_MAP[id] || CAT_MAP.default;
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
const fmtDate = (d, long = false) =>
  d
    ? new Date(d).toLocaleDateString(
        "en-US",
        long
          ? { month: "long", day: "numeric", year: "numeric" }
          : { month: "short", day: "numeric", year: "numeric" },
      )
    : "";

// ─── Content processing (any format → safe HTML) ─────────────────────────────
function processContent(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Case 1: Looks like real HTML (starts with a tag)
  const isHtml = /^<[a-zA-Z]/.test(trimmed);

  if (isHtml) {
    // Check if it's HTML with markdown leaking inside <p> tags (TinyMCE output)
    const hasLeakyMarkdown =
      /<p[^>]*>\s*#{1,6}\s|<p[^>]*>\s*\*\*|<p[^>]*>\s*[-*+]\s|<p[^>]*>\s*\d+\.\s|<p[^>]*>\s*```/i.test(
        trimmed,
      );
    if (!hasLeakyMarkdown) {
      // Clean HTML — return as-is
      return trimmed;
    }
    // Strip HTML to get back to plain text, then convert as markdown
    const stripped = raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
    return markdownToHtml(stripped);
  }

  // Case 2: Plain text or markdown — always convert through markdownToHtml
  // This handles: raw markdown, plain text paragraphs, mixed content
  return markdownToHtml(trimmed);
}
function markdownToHtml(md) {
  if (!md) return "";
  const codeBlocks = [];
  let protected_md = md.replace(
    /```([\w]*)\n?([\s\S]*?)```/g,
    (_, lang, code) => {
      codeBlocks.push(
        `<pre${lang ? ` data-language="${lang}"` : ""}><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`,
      );
      return `\x00CODEBLOCK${codeBlocks.length - 1}\x00`;
    },
  );
  const lines = protected_md.split("\n");
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\x00CODEBLOCK\d+\x00$/.test(line.trim())) {
      result.push(
        codeBlocks[
          parseInt(line.trim().replace(/\x00CODEBLOCK(\d+)\x00/, "$1"))
        ],
      );
      i++;
      continue;
    }
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      result.push(`<h${hm[1].length}>${inlineMd(hm[2])}</h${hm[1].length}>`);
      i++;
      continue;
    }
    if (/^---+$|^\*\*\*+$/.test(line.trim())) {
      result.push("<hr>");
      i++;
      continue;
    }
    if (/^>\s/.test(line)) {
      const bq = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bq.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      result.push(
        `<blockquote><p>${bq.map(inlineMd).join("<br>")}</p></blockquote>`,
      );
      continue;
    }
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^[-*+]\s+/, ""))}</li>`);
        i++;
      }
      result.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      result.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    if (line.trim() === "") {
      result.push("");
      i++;
      continue;
    }
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s|^[-*+]\s|^\d+\.\s|^>\s|^---+$|^\*\*\*+$|^\x00CODEBLOCK/.test(
        lines[i],
      )
    ) {
      paraLines.push(inlineMd(lines[i]));
      i++;
    }
    if (paraLines.length) result.push(`<p>${paraLines.join("<br>")}</p>`);
  }
  return result
    .join("\n")
    .replace(/(<\/p>)\n+(<p>)/g, "$1\n$2")
    .replace(/\n{3,}/g, "\n\n");
}

function inlineMd(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>");
}

function extractHeadings(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return Array.from(div.querySelectorAll("h2,h3")).map((n, i) => ({
    id: `heading-${i}`,
    level: n.tagName.toLowerCase(),
    text: n.textContent.trim(),
  }));
}

function injectHeadingIds(html) {
  let i = 0;
  return html.replace(
    /<(h[23])([^>]*)>/gi,
    (_, tag, attrs) => `<${tag}${attrs} id="heading-${i++}">`,
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────
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

// ─── Share Button ─────────────────────────────────────────────────────────────
function ShareButton({ slug, title, disabled }) {
  const [state, setState] = useState("idle");
  const popupRef = useRef(null);
  const url = `${window.location.origin}/blog/${slug}`;

  useEffect(() => {
    if (state !== "open") return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target))
        setState("idle");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [state]);

  const handleShare = async () => {
    if (disabled) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    setState("open");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      window.prompt("Copy link:", url);
      setState("idle");
    }
  };

  const shareVia = (platform) => {
    const enc = encodeURIComponent,
      t = enc(title),
      u = enc(url);
    const links = {
      twitter: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      whatsapp: `https://wa.me/?text=${t}%20${u}`,
    };
    window.open(
      links[platform],
      "_blank",
      "noopener,noreferrer,width=600,height=500",
    );
    setState("idle");
  };

  const SOCIALS = [
    {
      id: "twitter",
      label: "Twitter / X",
      bg: "#000",
      color: "#fff",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
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
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
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
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative" ref={popupRef}>
      <button
        onClick={handleShare}
        className={`action-btn ${state === "copied" ? "shared" : ""}`}
        title={disabled ? "Not available in preview" : "Share"}
      >
        {state === "copied" ? <Check size={14} /> : <Share2 size={15} />}
      </button>
      <AnimatePresence>
        {state === "open" && (
          <motion.div
            className="share-popup"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
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
              <button
                onClick={() => setState("idle")}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  border: "none",
                  background: "var(--c-ink-12)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--c-ink-70)",
                }}
              >
                <X size={12} />
              </button>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {SOCIALS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => shareVia(s.id)}
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
                </button>
              ))}
            </div>
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
              <button
                onClick={copyLink}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                style={{ background: "var(--c-slate)", color: "#fff" }}
              >
                Copy
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Table of Contents ────────────────────────────────────────────────────────
function TableOfContents({ headings, activeId }) {
  if (!headings.length) return null;
  return (
    <div
      style={{
        background: "var(--c-white)",
        border: "1px solid var(--c-border)",
        borderRadius: 20,
        padding: "1.25rem",
        boxShadow: "var(--sh-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <List size={14} style={{ color: "var(--c-amber)" }} />
        <span
          style={{
            fontSize: ".7rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: "var(--c-ink-40)",
          }}
        >
          Contents
        </span>
      </div>
      <nav
        style={{
          maxHeight: "calc(100vh - 280px)",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--c-border) transparent",
        }}
      >
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={`toc-link ${h.level === "h3" ? "h3" : ""} ${activeId === h.id ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(h.id);
              if (!el) return;
              const offset = 80;
              const top =
                el.getBoundingClientRect().top + window.scrollY - offset;
              window.scrollTo({ top, behavior: "smooth" });
            }}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

// ─── Reading Progress ─────────────────────────────────────────────────────────
function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  return (
    <div className="progress-bar">
      <motion.div
        className="progress-fill"
        style={{ scaleX, transformOrigin: "left" }}
      />
    </div>
  );
}

// ─── SEO ──────────────────────────────────────────────────────────────────────
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
      url: `https://talk2hire.com`,
    },
    publisher: {
      "@type": "Organization",
      name: "Talk2Hire",
      url: "https://talk2hire.com",
      logo: { "@type": "ImageObject", url: "https://talk2hire.com/logo.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
  return (
    <>
      <meta name="description" content={post.excerpt} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={post.title} />
      <meta property="og:description" content={post.excerpt} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={post.title} />
      <meta name="twitter:description" content={post.excerpt} />
      <meta name="twitter:image" content={image} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
};

// ─── Article Reader (full polished version) ───────────────────────────────────
const ArticleReader = ({ post, onBack, relatedPosts = [] }) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState(null);
  const [headings, setHeadings] = useState([]);
  const [processedContent, setProcessedContent] = useState("");

  const cat = getCat(post?.category);
  const color = avatarColor(post?.author_name);

  useEffect(() => {
    if (!post?.content) return;
    const html = processContent(post.content);
    const injected = injectHeadingIds(html);
    setProcessedContent(injected);
    setTimeout(() => setHeadings(extractHeadings(html)), 50);
  }, [post?.content]);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 600);
      for (let i = headings.length - 1; i >= 0; i--) {
        const el = document.getElementById(headings[i].id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveHeadingId(headings[i].id);
          return;
        }
      }
      setActiveHeadingId(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [headings]);

  if (!post) return null;
  if (post.content && !processedContent)
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid var(--c-border)",
            borderTopColor: "var(--c-amber)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );

  const p = {
    title: post.title || "Untitled Post",
    excerpt: post.excerpt || "",
    author_name: post.author_name || "Talk2Hire Team",
    author_username: post.author_username || "",
    published_at: post.published_at,
    read_time: post.read_time || 1,
    views: post.views || 0,
    tags: Array.isArray(post.tags) ? post.tags : [],
    cover_image: post.cover_image || null,
    category: post.category || "",
    content: processedContent,
    slug: post.slug || "",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <ArticleSEO post={post} />
      <ReadingProgress />

      <div className="article-root">
        {/* Sticky nav */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            borderBottom: "1px solid var(--c-border)",
            background: "rgba(255,255,255,0.90)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 24px",
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <motion.button
              onClick={onBack}
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: ".875rem",
                fontWeight: 600,
                color: "var(--c-ink-70)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <ArrowLeft size={16} /> Back to Blog
            </motion.button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setLiked(!liked)}
                className={`action-btn ${liked ? "liked" : ""}`}
                title="Like"
              >
                <Heart size={15} fill={liked ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => setBookmarked(!bookmarked)}
                className={`action-btn ${bookmarked ? "bookmarked" : ""}`}
                title="Bookmark"
              >
                <Bookmark
                  size={15}
                  fill={bookmarked ? "currentColor" : "none"}
                />
              </button>
              <ShareButton slug={p.slug} title={p.title} />
            </div>
          </div>
        </div>

        {/* Hero */}
        <section style={{ background: "var(--c-white)", paddingTop: 48 }}>
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 40px" }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 20,
                  flexWrap: "wrap",
                }}
              >
                {cat.label && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 14px",
                      borderRadius: 10,
                      fontSize: ".7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".1em",
                      background: cat.bg,
                      color: cat.color,
                      boxShadow: "var(--sh-sm)",
                    }}
                  >
                    <Tag size={10} /> {cat.label}
                  </span>
                )}
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.12,
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                fontSize: "clamp(28px,4.5vw,46px)",
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: "-.02em",
                color: "var(--c-ink)",
                marginBottom: 20,
                fontFamily: "'Playfair Display',serif",
              }}
            >
              {p.title}
            </motion.h1>

            {p.excerpt && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.22 }}
                style={{
                  fontSize: "1.15rem",
                  lineHeight: 1.7,
                  color: "var(--c-ink-70)",
                  fontWeight: 300,
                  marginBottom: 28,
                  fontStyle: "italic",
                  fontFamily: "'Playfair Display',serif",
                }}
              >
                {p.excerpt}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 16,
                paddingBottom: 28,
                borderBottom: "1px solid var(--c-border)",
                marginBottom: 40,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    background: color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: ".95rem",
                    fontFamily: "'Playfair Display',serif",
                  }}
                >
                  {p.author_name[0]}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: ".875rem",
                      fontWeight: 700,
                      color: "var(--c-ink)",
                    }}
                  >
                    {p.author_name}
                  </div>
                  {p.author_username && (
                    <div
                      style={{ fontSize: ".75rem", color: "var(--c-ink-40)" }}
                    >
                      @{p.author_username}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginLeft: "auto",
                  flexWrap: "wrap",
                }}
              >
                {p.published_at && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: ".75rem",
                      color: "var(--c-ink-40)",
                    }}
                  >
                    <Calendar size={12} /> {fmtDate(p.published_at, true)}
                  </span>
                )}
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: ".75rem",
                    color: "var(--c-ink-40)",
                  }}
                >
                  <Clock size={12} /> {p.read_time} min read
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: ".75rem",
                    color: "var(--c-ink-40)",
                  }}
                >
                  <Eye size={12} /> {p.views.toLocaleString()}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Cover image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18, duration: 0.65 }}
            style={{
              maxWidth: 980,
              margin: "0 auto",
              padding: "0 40px",
              paddingBottom: 56,
            }}
          >
            {p.cover_image ? (
              <img src={p.cover_image} alt={p.title} className="hero-cover" />
            ) : (
              <div
                className="cover-placeholder"
                style={{ background: cat.gradient }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.18,
                    backgroundImage:
                      "radial-gradient(circle,rgba(0,0,0,.06) 1px,transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                />
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 24,
                    background: "rgba(255,255,255,.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(10px)",
                    boxShadow: "var(--sh-lg)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <BookOpen size={38} style={{ color: cat.iconColor }} />
                </div>
              </div>
            )}
          </motion.div>
        </section>

        {/* Body + Sidebar */}
        <section
          style={{
            background: "#ffffff",
            paddingBottom: 80,
            overflowX: "hidden",
          }}
        >
          <div
            style={{
              maxWidth: 1400,
              margin: "0 auto",
              padding: "0 40px",
              display: "grid",
              gridTemplateColumns: "1fr min(820px,100%) 300px",
              gap: "0 56px",
              alignItems: "start",
              minWidth: 0,
            }}
          >
            <div />

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.6 }}
              style={{ minWidth: 0, overflow: "hidden" }}
            >
              {p.content ? (
                <div
                  className="blog-body drop-cap"
                  dangerouslySetInnerHTML={{ __html: p.content }}
                />
              ) : (
                <div
                  style={{
                    padding: "3rem 2rem",
                    textAlign: "center",
                    background: "var(--c-cream)",
                    borderRadius: 20,
                    border: "2px dashed var(--c-border)",
                    marginBottom: "2rem",
                  }}
                >
                  <BookOpen
                    size={32}
                    style={{
                      margin: "0 auto 12px",
                      display: "block",
                      opacity: 0.3,
                      color: "var(--c-ink-40)",
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: ".9rem",
                      color: "var(--c-ink-40)",
                      fontStyle: "italic",
                    }}
                  >
                    No content.
                  </p>
                </div>
              )}

              {/* Tags */}
              {p.tags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 48,
                    paddingTop: 32,
                    borderTop: "1px solid var(--c-border)",
                  }}
                >
                  {p.tags.map((t) => (
                    <span key={t} className="tag-pill">
                      <Tag size={9} /> {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Author card */}
              <motion.div
                className="author-card"
                style={{ marginTop: 40 }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 20,
                      background: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "1.2rem",
                      fontFamily: "'Playfair Display',serif",
                      flexShrink: 0,
                    }}
                  >
                    {p.author_name[0]}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "1rem",
                        color: "var(--c-ink)",
                        fontFamily: "'Playfair Display',serif",
                      }}
                    >
                      {p.author_name}
                    </div>
                    {p.author_username && (
                      <div
                        style={{
                          fontSize: ".8rem",
                          color: "var(--c-ink-40)",
                          marginTop: 2,
                        }}
                      >
                        @{p.author_username}
                      </div>
                    )}
                  </div>
                </div>
                <p
                  style={{
                    fontSize: ".9rem",
                    lineHeight: 1.75,
                    color: "var(--c-ink-70)",
                    margin: 0,
                  }}
                >
                  A seasoned professional sharing real-world insights to help
                  candidates navigate the modern job market with confidence and
                  clarity.
                </p>
              </motion.div>

              {/* Related posts */}
              {relatedPosts.length > 0 && (
                <div style={{ marginTop: 56 }}>
                  <h3
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "var(--c-ink)",
                      marginBottom: 20,
                      fontFamily: "'Playfair Display',serif",
                    }}
                  >
                    Related Articles
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(240px,1fr))",
                      gap: 16,
                    }}
                  >
                    {relatedPosts.map((rp, i) => {
                      const rc = getCat(rp.category);
                      return (
                        <motion.div
                          key={rp.id}
                          className="related-card"
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.55 + i * 0.08 }}
                          onClick={() => navigate(`/blog/${rp.slug}`)}
                        >
                          {rc.label && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: 8,
                                fontSize: ".65rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: ".08em",
                                background: rc.bg,
                                color: rc.color,
                                marginBottom: 10,
                              }}
                            >
                              {rc.label}
                            </span>
                          )}
                          <h4
                            style={{
                              fontFamily: "'Playfair Display',serif",
                              fontWeight: 700,
                              fontSize: ".9rem",
                              lineHeight: 1.4,
                              color: "var(--c-ink)",
                              marginBottom: 10,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {rp.title}
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: ".7rem",
                                color: "var(--c-ink-40)",
                              }}
                            >
                              <Clock size={10} /> {rp.read_time}m
                            </span>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: ".7rem",
                                color: "var(--c-ink-40)",
                              }}
                            >
                              <Eye size={10} /> {rp.views || 0}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Sidebar */}
            <div
              className="sidebar-sticky"
              style={{
                position: "sticky",
                top: 72,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
              >
                {/* Stats */}
                <div
                  style={{
                    background: "var(--c-cream)",
                    border: "1px solid var(--c-border)",
                    borderRadius: 20,
                    padding: "1.25rem",
                    marginBottom: 20,
                    boxShadow: "var(--sh-sm)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    {[
                      { label: "Read time", value: `${p.read_time}m` },
                      { label: "Views", value: p.views.toLocaleString() },
                      { label: "Tags", value: p.tags.length },
                      { label: "Category", value: cat.label || "—" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          background: "var(--c-white)",
                          border: "1px solid var(--c-border)",
                          borderRadius: 12,
                          padding: "10px 12px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "1rem",
                            fontWeight: 700,
                            color: "var(--c-ink)",
                            fontFamily: "'Playfair Display',serif",
                          }}
                        >
                          {s.value}
                        </div>
                        <div
                          style={{
                            fontSize: ".65rem",
                            color: "var(--c-ink-40)",
                            marginTop: 2,
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: ".06em",
                          }}
                        >
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    background: "var(--c-white)",
                    border: "1px solid var(--c-border)",
                    borderRadius: 20,
                    padding: "1.25rem",
                    marginBottom: 20,
                    boxShadow: "var(--sh-sm)",
                  }}
                >
                  <p
                    style={{
                      fontSize: ".7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".1em",
                      color: "var(--c-ink-40)",
                      marginBottom: 12,
                      margin: "0 0 12px",
                    }}
                  >
                    Actions
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setLiked(!liked)}
                      className={`action-btn ${liked ? "liked" : ""}`}
                      style={{ flex: 1, width: "auto" }}
                      title="Like"
                    >
                      <Heart size={15} fill={liked ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => setBookmarked(!bookmarked)}
                      className={`action-btn ${bookmarked ? "bookmarked" : ""}`}
                      style={{ flex: 1, width: "auto" }}
                      title="Bookmark"
                    >
                      <Bookmark
                        size={15}
                        fill={bookmarked ? "currentColor" : "none"}
                      />
                    </button>
                    <ShareButton slug={p.slug} title={p.title} />
                  </div>
                </div>

                {/* Table of contents */}
                <TableOfContents
                  headings={headings}
                  activeId={activeHeadingId}
                />
              </motion.div>
            </div>
          </div>
        </section>
      </div>

      {/* Scroll to top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            className="scroll-top"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            title="Back to top"
          >
            <ChevronUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Post Cards ───────────────────────────────────────────────────────────────
const FeaturedCard = ({ post, onRead }) => {
  const cat = CATEGORIES.find((c) => c.id === post.category);
  const { gradient } = getCat(post.category);
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
          style={{
            color: "var(--c-ink)",
            fontFamily: "'Playfair Display',serif",
          }}
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

const PostCard = ({ post, index, onRead }) => {
  const cat = CATEGORIES.find((c) => c.id === post.category);
  const { gradient, iconColor } = getCat(post.category);
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
          style={{
            color: "var(--c-ink)",
            fontFamily: "'Playfair Display',serif",
          }}
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

// ─── Blog List ────────────────────────────────────────────────────────────────
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
                fontFamily: "'Playfair Display',serif",
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
          <h2
            className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight leading-[1.06]"
            style={{ fontFamily: "'Playfair Display',serif" }}
          >
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

// ─── Blog Post page ───────────────────────────────────────────────────────────
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
        clearActivePost();
        navigate("/blog");
      }}
      relatedPosts={relatedPosts}
    />
  );
};

// ─── Root Blog component ──────────────────────────────────────────────────────
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
