import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "motion/react";
import {
  ArrowLeft,
  Clock,
  Eye,
  Tag,
  Heart,
  Bookmark,
  Share2,
  Check,
  X,
  Calendar,
  BookOpen,
  ChevronUp,
  List,
} from "lucide-react";

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

  .article-root { font-family:'DM Sans',sans-serif; color:var(--c-ink); background:var(--c-white); min-height:100vh; }
  .article-root h1,.article-root h2,.article-root h3,.article-root h4 { font-family:'Playfair Display',Georgia,serif; }

  .progress-bar {
    position:fixed; top:0; left:0; right:0; z-index:60;
    height:3px; background:var(--c-border); transform-origin:left;
  }
  .progress-fill {
    height:100%; background:linear-gradient(90deg,var(--c-amber),var(--c-amber-2),var(--c-amber));
    background-size:200% 100%; animation:shimmer 2s linear infinite;
    border-radius:0 2px 2px 0;
  }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  .sticky-nav {
    position:sticky; top:0; z-index:50; border-bottom:1px solid var(--c-border);
    background:rgba(255,255,255,0.90); backdrop-filter:blur(24px);
  }

  .hero-cover {
    width:100%; height:480px; object-fit:cover; display:block;
    border-radius:24px; box-shadow:var(--sh-xl);
  }
  .cover-placeholder {
    width:100%; height:480px; border-radius:24px;
    display:flex; align-items:center; justify-content:center;
    position:relative; overflow:hidden; box-shadow:var(--sh-xl);
  }

  .blog-body { font-size:1.0625rem; line-height:1.9; color:var(--c-ink-70); }
  .blog-body h1,.blog-body h2,.blog-body h3,.blog-body h4 { font-family:'Playfair Display',serif; color:var(--c-ink); }
  .blog-body h2 { font-size:1.65rem; font-weight:700; margin:2.25rem 0 .9rem; padding-top:.5rem; border-top:1px solid var(--c-border); }
  .blog-body h3 { font-size:1.2rem; font-weight:700; margin:1.75rem 0 .6rem; }
  .blog-body p { margin:0 0 1.4rem; }
  .blog-body strong { font-weight:700; color:var(--c-ink); }
  .blog-body em { font-style:italic; }
  .blog-body a { color:var(--c-sky); text-decoration:underline; text-underline-offset:3px; font-weight:500; }
  .blog-body a:hover { color:var(--c-slate); }
  .blog-body ul,.blog-body ol { margin:0 0 1.4rem 1.75rem; }
  .blog-body li { margin-bottom:.55rem; line-height:1.8; }
  .blog-body li::marker { color:var(--c-amber); font-weight:700; }
  .blog-body blockquote {
    border-left:3px solid var(--c-amber); margin:2rem 0; padding:.9rem 1.4rem;
    background:var(--c-amber-l); border-radius:0 14px 14px 0; font-style:italic;
  }
  .blog-body blockquote p { margin:0; }
  .blog-body code {
    background:var(--c-ink-12); padding:.2em .45em; border-radius:6px;
    font-size:.875em; font-family:'Fira Code',monospace; color:var(--c-violet);
    border:1px solid var(--c-border);
  }
  .blog-body pre {
    background:var(--c-slate); color:#e2e8f0; padding:1.375rem 1.625rem;
    border-radius:16px; overflow-x:auto; margin:1.5rem 0; font-size:.875rem; line-height:1.75;
  }
  .blog-body pre code { background:none; padding:0; border:none; color:inherit; }
  .blog-body hr { border:none; height:1px; background:linear-gradient(90deg,transparent,var(--c-border),transparent); margin:2.5rem 0; }
  .blog-body img { max-width:100%; border-radius:14px; margin:1.5rem auto; display:block; box-shadow:var(--sh-md); }
  .blog-body table { width:100%; border-collapse:collapse; margin:1.5rem 0; font-size:.9rem; border-radius:12px; overflow:hidden; box-shadow:var(--sh-sm); }
  .blog-body thead { background:var(--c-slate); color:#fff; }
  .blog-body th { font-weight:700; padding:.75rem 1.125rem; text-align:left; color:#fff; font-size:.8rem; text-transform:uppercase; letter-spacing:.05em; }
  .blog-body td { padding:.75rem 1.125rem; border-bottom:1px solid var(--c-border); color:var(--c-ink-70); }
  .blog-body tbody tr:nth-child(even) { background:rgba(13,13,18,.025); }
  .blog-body tbody tr:hover { background:var(--c-amber-l); transition:background .15s; }
  .blog-body tbody tr:last-child td { border-bottom:none; }

  .toc-link {
    display:block; padding:6px 12px; border-radius:8px; font-size:.8rem;
    color:var(--c-ink-70); text-decoration:none; font-weight:500;
    border-left:2px solid transparent; transition:all .15s; cursor:pointer;
  }
  .toc-link:hover,.toc-link.active {
    color:var(--c-amber); border-left-color:var(--c-amber); background:var(--c-amber-l);
  }
  .toc-link.h3 { padding-left:24px; font-size:.75rem; }

  .action-btn {
    width:38px; height:38px; border-radius:12px; border:1px solid var(--c-border);
    display:flex; align-items:center; justify-content:center; cursor:pointer;
    background:var(--c-white); color:var(--c-ink-40); transition:all .15s;
  }
  .action-btn:hover { border-color:var(--c-ink-40); color:var(--c-ink); }
  .action-btn.liked { background:var(--c-rose-l); border-color:var(--c-rose); color:var(--c-rose); }
  .action-btn.bookmarked { background:var(--c-amber-l); border-color:var(--c-amber); color:var(--c-amber); }
  .action-btn.shared { background:var(--c-sage-l); border-color:var(--c-sage); color:var(--c-sage); }
  .action-btn.disabled { opacity:.4; cursor:not-allowed; }

  .share-popup {
    position:absolute; right:0; top:50px; z-index:50; width:280px;
    background:var(--c-white); border:1px solid var(--c-border);
    border-radius:20px; overflow:hidden; box-shadow:var(--sh-xl);
  }

  .tag-pill {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 12px; border-radius:10px; border:1px solid var(--c-border);
    font-size:.7rem; font-weight:600; color:var(--c-ink-70);
    background:var(--c-cream); text-transform:lowercase; letter-spacing:.01em;
    transition:all .15s; cursor:default;
  }
  .tag-pill:hover { border-color:var(--c-amber); color:var(--c-amber); background:var(--c-amber-l); }

  .author-card {
    background:linear-gradient(135deg,var(--c-cream) 0%,rgba(254,243,199,.6) 100%);
    border:1px solid var(--c-border); border-radius:24px; padding:2rem; box-shadow:var(--sh-sm);
  }

  .related-card {
    background:var(--c-white); border:1px solid var(--c-border);
    border-radius:20px; padding:1.25rem; cursor:pointer;
    transition:transform .25s,box-shadow .25s;
  }
  .related-card:hover { transform:translateY(-5px); box-shadow:var(--sh-lg); }

  .scroll-top {
    position:fixed; bottom:28px; right:28px; z-index:50;
    width:44px; height:44px; border-radius:14px; border:1px solid var(--c-border);
    background:var(--c-white); display:flex; align-items:center; justify-content:center;
    cursor:pointer; box-shadow:var(--sh-md); color:var(--c-ink-70); transition:all .15s;
  }
  .scroll-top:hover { background:var(--c-slate); color:#fff; border-color:var(--c-slate); transform:translateY(-2px); }

  .drop-cap::first-letter {
    font-family:'Playfair Display',serif; font-size:4.2rem; font-weight:900;
    float:left; line-height:.82; margin:0.08em 0.1em 0 0;
    color:var(--c-ink); letter-spacing:-.02em;
  }

  .draft-watermark {
    position:fixed; bottom:60px; right:24px; z-index:55;
    background:rgba(17,24,39,.85); color:#9ca3af; backdrop-filter:blur(8px);
    padding:6px 14px; border-radius:8px; font-size:11px; font-weight:600;
    letter-spacing:.06em; text-transform:uppercase; pointer-events:none;
    border:1px solid rgba(255,255,255,.08);
  }

  .empty-content {
    padding:3rem 2rem; text-align:center; background:var(--c-cream);
    border-radius:20px; border:2px dashed var(--c-border); margin-bottom:2rem;
  }

  @media(max-width:1100px) { .sidebar-sticky { display:none; } }
  @media(max-width:680px) { .hero-cover,.cover-placeholder { height:280px; } }
`;

const CATEGORIES = {
  interview: {
    label: "Interview Tips",
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
  },
  career: {
    label: "Career Growth",
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
  },
  ai: { label: "AI & Tech", color: "var(--c-violet)", bg: "var(--c-violet-l)" },
  salary: {
    label: "Salary & Offers",
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
  },
  resume: {
    label: "Resume & Profile",
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
  },
};

const GRADIENTS = {
  interview: "linear-gradient(135deg,#ffe4e6 0%,#fecdd3 100%)",
  career: "linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%)",
  ai: "linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)",
  salary: "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)",
  resume: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%)",
  default: "linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%)",
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

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

// Detect if content is raw markdown (not HTML) and convert it
// Convert markdown syntax to HTML — handles both raw markdown
// AND TinyMCE output where markdown is wrapped inside <p> tags
function processContent(raw) {
  if (!raw) return "";

  // Step 1: If TinyMCE wrapped markdown in <p> tags, unwrap to plain text first
  // Detect: content is HTML but inner text still has ## / ** / - markdown
  let text = raw;
  const looksLikeWrappedMarkdown =
    /^<p>/i.test(raw.trim()) &&
    /<p>\s*#{1,6}\s|<p>\s*\*\*|<p>\s*[-*+]\s|<p>\s*\d+\.\s|<p>\s*```/i.test(
      raw,
    );

  if (looksLikeWrappedMarkdown) {
    // Unwrap: strip all HTML tags to get back to plain text
    text = raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  // Step 2: Check if the (possibly unwrapped) text contains markdown syntax
  const hasMarkdown =
    /^#{1,6}\s|\n#{1,6}\s|\*\*[^*]|\*[^*]|^[-*+]\s|\n[-*+]\s|^>\s|\n>\s|^```|\n```|^\d+\.\s|\n\d+\.\s/m.test(
      text,
    );

  // Step 3: If it's clean HTML (no markdown in it), return as-is
  if (!hasMarkdown && /^<[a-z]/i.test(text.trim())) return text;

  // Step 4: Convert markdown → HTML
  return markdownToHtml(text);
}

function markdownToHtml(md) {
  if (!md) return "";

  // Protect fenced code blocks from inline processing
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

  // Process line by line for block elements
  const lines = protected_md.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block placeholder
    if (/^\x00CODEBLOCK\d+\x00$/.test(line.trim())) {
      const idx = parseInt(line.trim().replace(/\x00CODEBLOCK(\d+)\x00/, "$1"));
      result.push(codeBlocks[idx]);
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      result.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$|^\*\*\*+$/.test(line.trim())) {
      result.push("<hr>");
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s/.test(line)) {
      const bqLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bqLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      result.push(
        `<blockquote><p>${bqLines.map(inlineMarkdown).join("<br>")}</p></blockquote>`,
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(
          `<li>${inlineMarkdown(lines[i].replace(/^[-*+]\s+/, ""))}</li>`,
        );
        i++;
      }
      result.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(
          `<li>${inlineMarkdown(lines[i].replace(/^\d+\.\s+/, ""))}</li>`,
        );
        i++;
      }
      result.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Empty line → paragraph break signal
    if (line.trim() === "") {
      result.push("");
      i++;
      continue;
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s|^[-*+]\s|^\d+\.\s|^>\s|^---+$|^\*\*\*+$|^\x00CODEBLOCK/.test(
        lines[i],
      )
    ) {
      paraLines.push(inlineMarkdown(lines[i]));
      i++;
    }
    if (paraLines.length) result.push(`<p>${paraLines.join("<br>")}</p>`);
  }

  // Merge consecutive paragraphs separated by blank lines
  return result
    .join("\n")
    .replace(/(<\/p>)\n+(<p>)/g, "$1\n$2")
    .replace(/\n{3,}/g, "\n\n");
}

// Process inline markdown (bold, italic, code, links, images)
function inlineMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/___(.+?)___/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
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
      <nav>
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={`toc-link ${h.level === "h3" ? "h3" : ""} ${activeId === h.id ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById(h.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

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

  return (
    <div style={{ position: "relative" }} ref={popupRef}>
      <button
        onClick={handleShare}
        className={`action-btn ${state === "copied" ? "shared" : ""} ${disabled ? "disabled" : ""}`}
        title={disabled ? "Not available in preview" : "Share"}
      >
        {state === "copied" ? <Check size={15} /> : <Share2 size={15} />}
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
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--c-border)",
              }}
            >
              <span
                style={{
                  fontSize: ".7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  color: "var(--c-ink)",
                }}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
                padding: 12,
              }}
            >
              {[
                {
                  id: "twitter",
                  label: "Twitter",
                  bg: "#000",
                  icon: (
                    <svg
                      width="14"
                      height="14"
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
                  icon: (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  ),
                },
                {
                  id: "whatsapp",
                  label: "WhatsApp",
                  bg: "#25D366",
                  icon: (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  ),
                },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => shareVia(s.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 0",
                    borderRadius: 12,
                    background: `${s.bg}12`,
                    border: `1px solid ${s.bg}22`,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: s.bg,
                      color: "#fff",
                    }}
                  >
                    {s.icon}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--c-ink-70)",
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
            <div
              style={{
                margin: "0 12px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--c-cream)",
                border: "1px solid var(--c-border)",
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontFamily: "'Fira Code',monospace",
                  color: "var(--c-ink-70)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {url}
              </span>
              <button
                onClick={copyLink}
                style={{
                  flexShrink: 0,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "var(--c-slate)",
                  color: "#fff",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                }}
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

export default function BlogArticle({
  post,
  onBack,
  relatedPosts = [],
  isPreview = false,
}) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState(null);
  const [headings, setHeadings] = useState([]);
  const [processedContent, setProcessedContent] = useState("");

  const cat = CATEGORIES[post?.category] ?? null;
  const gradient = GRADIENTS[post?.category] ?? GRADIENTS.default;
  const color = avatarColor(post?.author_name);

  useEffect(() => {
    if (!post?.content) return;
    // Handles: clean HTML, raw markdown, and markdown wrapped in <p> by TinyMCE
    const html = processContent(post.content);
    const injected = injectHeadingIds(html);
    setProcessedContent(injected);
    setTimeout(() => setHeadings(extractHeadings(html)), 50);
  }, [post?.content]);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 600);
      const ids = headings.map((h) => h.id);
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveHeadingId(ids[i]);
          return;
        }
      }
      setActiveHeadingId(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [headings]);

  if (!post) return null;

  const p = {
    title: post.title || "Untitled Post",
    subtitle: post.subtitle || post.excerpt || "",
    author_name: post.author_name || "Talk2Hire Team",
    author_username: post.author_username || "",
    published_at: post.published_at,
    read_time: post.read_time || 1,
    views: post.views || 0,
    tags: Array.isArray(post.tags) ? post.tags : [],
    cover_image: post.cover_image || null,
    category: post.category || "",
    content: processedContent || post.content || "",
    slug: post.slug || "preview",
  };

  const sidebarTop = 80;

  return (
    <>
      <style>{TOKENS}</style>
      {!isPreview && <ReadingProgress />}

      <div className="article-root">
        {/* Preview chrome bar is owned by BlogAdmin — not rendered here */}

        {/* ── Sticky article nav ───────────────────────────── */}
        <div className="sticky-nav">
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
            {/* Back button — hidden in preview (BlogAdmin chrome has one) */}
            {!isPreview ? (
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
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "var(--c-amber-l)",
                    color: "var(--c-amber)",
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(217,119,6,.2)",
                  }}
                >
                  Preview
                </span>
                <span style={{ fontSize: 12, color: "var(--c-ink-40)" }}>
                  {p.title.length > 52 ? p.title.slice(0, 52) + "…" : p.title}
                </span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => !isPreview && setLiked((x) => !x)}
                className={`action-btn ${liked ? "liked" : ""} ${isPreview ? "disabled" : ""}`}
                title="Like"
              >
                <Heart size={15} fill={liked ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => !isPreview && setBookmarked((x) => !x)}
                className={`action-btn ${bookmarked ? "bookmarked" : ""} ${isPreview ? "disabled" : ""}`}
                title="Bookmark"
              >
                <Bookmark
                  size={15}
                  fill={bookmarked ? "currentColor" : "none"}
                />
              </button>
              <ShareButton slug={p.slug} title={p.title} disabled={isPreview} />
            </div>
          </div>
        </div>

        {/* ── Hero ─────────────────────────────────────────── */}
        <section style={{ background: "var(--c-white)", paddingTop: 48 }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
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
                {cat && (
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
                {isPreview && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: ".7rem",
                      fontWeight: 600,
                      color: "#9ca3af",
                      background: "#f3f4f6",
                      padding: "5px 12px",
                      borderRadius: 10,
                      border: "1px dashed #d1d5db",
                    }}
                  >
                    <Eye size={10} /> Live Preview
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
              }}
            >
              {p.title}
            </motion.h1>

            {p.subtitle && (
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
                {p.subtitle}
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
                {p.published_at ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: ".75rem",
                      color: "var(--c-ink-40)",
                    }}
                  >
                    <Calendar size={12} /> {fmtDate(p.published_at)}
                  </span>
                ) : isPreview ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: ".75rem",
                      color: "#9ca3af",
                      fontStyle: "italic",
                    }}
                  >
                    <Calendar size={12} /> Not published yet
                  </span>
                ) : null}
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
                  <Eye size={12} /> {isPreview ? "—" : p.views.toLocaleString()}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Cover */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18, duration: 0.65 }}
            style={{
              maxWidth: 860,
              margin: "0 auto",
              padding: "0 24px",
              paddingBottom: 56,
            }}
          >
            {p.cover_image ? (
              <img src={p.cover_image} alt={p.title} className="hero-cover" />
            ) : (
              <div
                className="cover-placeholder"
                style={{ background: gradient }}
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
                  <BookOpen
                    size={38}
                    style={{ color: cat?.color || "var(--c-ink-40)" }}
                  />
                </div>
                {isPreview && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 16,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(0,0,0,.5)",
                      color: "#fff",
                      fontSize: 11,
                      padding: "4px 14px",
                      borderRadius: 6,
                      backdropFilter: "blur(4px)",
                      whiteSpace: "nowrap",
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    No cover image — set one in Post Settings
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Body + Sidebar ───────────────────────────────── */}
        <section style={{ background: "var(--c-white)", paddingBottom: 80 }}>
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 24px",
              display: "grid",
              gridTemplateColumns: "1fr min(680px,100%) 280px",
              gap: "0 48px",
              alignItems: "start",
            }}
          >
            <div />

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.6 }}
            >
              {p.content ? (
                <div
                  className="blog-body drop-cap"
                  dangerouslySetInnerHTML={{ __html: p.content }}
                />
              ) : (
                <div className="empty-content">
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
                    {isPreview
                      ? "No content yet — start writing in the editor."
                      : "No content."}
                  </p>
                </div>
              )}

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

              {relatedPosts.length > 0 && (
                <div style={{ marginTop: 56 }}>
                  <h3
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "var(--c-ink)",
                      marginBottom: 20,
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
                      const rc = CATEGORIES[rp.category];
                      return (
                        <motion.div
                          key={rp.id}
                          className="related-card"
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.55 + i * 0.08 }}
                          onClick={() =>
                            !isPreview &&
                            (window.location.href = `/blog/${rp.slug}`)
                          }
                          style={isPreview ? { cursor: "default" } : {}}
                        >
                          {rc && (
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
                top: sidebarTop,
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
                      {
                        label: "Views",
                        value: isPreview ? "—" : p.views.toLocaleString(),
                      },
                      { label: "Tags", value: p.tags.length },
                      { label: "Category", value: cat?.label || "—" },
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
                    }}
                  >
                    Actions
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => !isPreview && setLiked((x) => !x)}
                      className={`action-btn ${liked ? "liked" : ""} ${isPreview ? "disabled" : ""}`}
                      style={{ flex: 1, width: "auto" }}
                      title="Like"
                    >
                      <Heart size={15} fill={liked ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => !isPreview && setBookmarked((x) => !x)}
                      className={`action-btn ${bookmarked ? "bookmarked" : ""} ${isPreview ? "disabled" : ""}`}
                      style={{ flex: 1, width: "auto" }}
                      title="Bookmark"
                    >
                      <Bookmark
                        size={15}
                        fill={bookmarked ? "currentColor" : "none"}
                      />
                    </button>
                    <ShareButton
                      slug={p.slug}
                      title={p.title}
                      disabled={isPreview}
                    />
                  </div>
                  {isPreview && (
                    <p
                      style={{
                        fontSize: ".7rem",
                        color: "var(--c-ink-40)",
                        marginTop: 10,
                        marginBottom: 0,
                        textAlign: "center",
                        fontStyle: "italic",
                      }}
                    >
                      Interactions disabled in preview
                    </p>
                  )}
                </div>

                <TableOfContents
                  headings={headings}
                  activeId={activeHeadingId}
                />
              </motion.div>
            </div>
          </div>
        </section>
      </div>

      {/* Scroll to top — only in live view */}
      {!isPreview && (
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
      )}

      {isPreview && <div className="draft-watermark">Draft Preview</div>}
    </>
  );
}
