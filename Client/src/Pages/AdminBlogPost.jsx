import { useEffect, useRef, useState, useCallback } from "react";
import { useBlog } from "../Hooks/useBlogHook";

const TINYMCE_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.3/tinymce.min.js";
// Values must match the DB ENUM and the public Blog's category filter ids
const CATEGORIES = [
  { value: "interview", label: "Interview Tips" },
  { value: "career", label: "Career Growth" },
  { value: "ai", label: "AI & Tech" },
  { value: "salary", label: "Salary & Offers" },
  { value: "resume", label: "Resume & Profile" },
];

function useAutoSave(cb, delay = 2000) {
  const t = useRef(null);
  return useCallback(() => {
    clearTimeout(t.current);
    t.current = setTimeout(cb, delay);
  }, [cb, delay]);
}

function Chip({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px",
        fontSize: 12,
        borderRadius: 4,
        border: `1.5px solid ${active ? "#4F6EF7" : "#e5e7eb"}`,
        background: active ? "#eef2ff" : "#fff",
        color: active ? "#4F6EF7" : "#6b7280",
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: 500,
        transition: "all .15s",
        lineHeight: 1.6,
      }}
    >
      {children}
    </button>
  );
}

function TagPill({ label, onRemove }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 3,
        background: "#f3f4f6",
        color: "#374151",
        fontSize: 12,
        fontWeight: 500,
        border: "1px solid #e5e7eb",
      }}
    >
      {label}
      <span
        onClick={onRemove}
        style={{
          cursor: "pointer",
          color: "#9ca3af",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </span>
    </span>
  );
}

function CheckRow({ label, ok }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}
    >
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ok ? "#4F6EF7" : "transparent",
          border: ok ? "none" : "1.5px solid #d1d5db",
          fontSize: 9,
          color: "#fff",
          transition: "background .25s",
        }}
      >
        {ok ? "✓" : ""}
      </span>
      <span
        style={{
          fontSize: 12,
          color: ok ? "#111827" : "#9ca3af",
          fontWeight: ok ? 500 : 400,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function PreviewModal({
  title,
  subtitle,
  coverImage,
  content,
  tags,
  category,
  wordCount,
  readTime,
  onClose,
}) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const html = `<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0} body{font-family:'Lora',serif;color:#111827;background:#fff}
    .wrap{max-width:700px;margin:0 auto;padding:52px 24px 80px}
    .meta{display:flex;align-items:center;gap:10px;margin-bottom:24px;font-family:'Sora',sans-serif;font-size:13px;color:#6b7280}
    .cat{background:#eef2ff;color:#4F6EF7;padding:3px 10px;border-radius:3px;font-weight:600;font-size:11px;text-transform:uppercase}
    h1{font-family:'Sora',sans-serif;font-size:clamp(1.8rem,4vw,2.5rem);font-weight:700;color:#111827;line-height:1.2;margin-bottom:12px}
    .sub{font-size:1.1rem;color:#6b7280;line-height:1.65;margin-bottom:28px;font-style:italic}
    .cover{width:100%;height:360px;object-fit:cover;border-radius:6px;margin-bottom:40px;display:block}
    .body{font-size:1.05rem;line-height:1.85;color:#1f2937} .body p{margin:0 0 1.25em}
    .body h2{font-family:'Sora',sans-serif;font-size:1.4rem;font-weight:700;margin:2em 0 .6em}
    .body blockquote{margin:1.5em 0;padding:14px 20px;border-left:3px solid #4F6EF7;background:#f8faff;font-style:italic}
    .body a{color:#4F6EF7} .body code{background:#f3f4f6;padding:2px 6px;border-radius:3px;font-size:.85em;color:#b45309}
    .body img{max-width:100%;border-radius:5px} .body ul,.body ol{padding-left:1.5em;margin:0 0 1.2em}
    .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:36px;padding-top:24px;border-top:1px solid #f3f4f6}
    .tag{font-family:'Sora',sans-serif;font-size:11px;font-weight:600;color:#374151;background:#f3f4f6;padding:3px 10px;border-radius:3px}
  </style></head><body><div class="wrap">
  <div class="meta">${category ? `<span class="cat">${category}</span>` : ""}<span>${readTime} min read</span><span>·</span><span>${wordCount.toLocaleString()} words</span></div>
  <h1>${title || "Untitled Post"}</h1>
  ${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
  ${coverImage ? `<img class="cover" src="${coverImage}" alt="">` : ""}
  <div class="body">${content}</div>
  ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">#${t}</span>`).join("")}</div>` : ""}
  </div></body></html>`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: "#111827",
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
            }}
          />
          <span
            style={{
              color: "#d1d5db",
              fontSize: 13,
              fontFamily: "'Sora',sans-serif",
            }}
          >
            Preview Mode
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "4px 14px",
            border: "1px solid #374151",
            borderRadius: 4,
            background: "transparent",
            color: "#d1d5db",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ✕ Close (Esc)
        </button>
      </div>
      <iframe
        srcDoc={html}
        style={{ flex: 1, border: "none" }}
        title="Preview"
      />
    </div>
  );
}

export default function AdminBlogPost({ initialPost = null, onBack }) {
  const editorTextarea = useRef(null);
  const tinymce = useRef(null);
  const fileInputRef = useRef(null);
  const coverFileRef = useRef(null);

  // ── THE FIX ──────────────────────────────────────────────────────────────
  // Track the post id in a ref so it persists across re-renders without
  // causing re-renders itself. After the first createPost succeeds we store
  // the returned id here, and every subsequent save (including auto-save)
  // uses updatePost(postId.current, ...) instead of createPost.
  const postId = useRef(initialPost?.id ?? null);
  // ─────────────────────────────────────────────────────────────────────────

  const { createPost, updatePost, saving, error } = useBlog();

  const [title, setTitle] = useState(initialPost?.title || "");
  const [subtitle, setSubtitle] = useState(initialPost?.subtitle || "");
  // Sanitize: only accept values that exist in CATEGORIES — old DB values get cleared
  const VALID_CAT_VALUES = CATEGORIES.map((c) => c.value);
  const [category, setCategory] = useState(
    VALID_CAT_VALUES.includes(initialPost?.category)
      ? initialPost.category
      : "",
  );
  const [tags, setTags] = useState(() => {
    if (!initialPost?.tags) return [];
    return Array.isArray(initialPost.tags)
      ? initialPost.tags
      : JSON.parse(initialPost.tags);
  });
  const [tagInput, setTagInput] = useState("");
  const [coverImage, setCoverImage] = useState(initialPost?.cover_image || "");
  const [wordCount, setWordCount] = useState(initialPost?.word_count || 0);
  const [readTime, setReadTime] = useState(initialPost?.read_time || 1);
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [status, setStatus] = useState(initialPost?.status || "draft");
  const [activeTab, setActiveTab] = useState("write");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHTML, setPreviewHTML] = useState("");
  const [toast, setToast] = useState(null);

  // Mirror every piece of form state into refs so callbacks that must be
  // stable (doAutoSave, initEditor) can always read the latest value without
  // being listed as dependencies — which would cause TinyMCE to re-init on
  // every keystroke and produce the blinking effect.
  const titleRef = useRef(title);
  const subtitleRef = useRef(subtitle);
  const categoryRef = useRef(category);
  const tagsRef = useRef(tags);
  const coverRef = useRef(coverImage);
  const wordCountRef = useRef(wordCount);
  const readTimeRef = useRef(readTime);
  const statusRef = useRef(status);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    subtitleRef.current = subtitle;
  }, [subtitle]);
  useEffect(() => {
    categoryRef.current = category;
  }, [category]);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);
  useEffect(() => {
    coverRef.current = coverImage;
  }, [coverImage]);
  useEffect(() => {
    wordCountRef.current = wordCount;
  }, [wordCount]);
  useEffect(() => {
    readTimeRef.current = readTime;
  }, [readTime]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getContent = () => tinymce.current?.getContent() || "";

  // buildPayload reads from refs — safe to call from any stable callback
  const buildPayload = useCallback((overrideStatus) => {
    const content = tinymce.current?.getContent() || "";
    return {
      title: titleRef.current,
      subtitle: subtitleRef.current,
      category: categoryRef.current,
      tags: tagsRef.current,
      cover_image: coverRef.current,
      word_count: wordCountRef.current,
      read_time: readTimeRef.current,
      content,
      excerpt:
        subtitleRef.current || content.replace(/<[^>]+>/g, "").slice(0, 200),
      status: overrideStatus || statusRef.current,
    };
  }, []); // no deps — reads via refs

  // RTK dispatch returns { meta: { requestStatus: 'fulfilled'|'rejected' } }
  // result.error is the action object, not a string — use this helper everywhere
  const isRejected = (result) => result?.meta?.requestStatus === "rejected";
  const errorMsg = (result) => result?.payload || "Something went wrong";

  // Shared save logic — creates once, updates forever after
  const persistPost = useCallback(
    async (payload) => {
      let result;
      if (postId.current) {
        result = await updatePost(postId.current, payload);
      } else {
        result = await createPost(payload);
        if (!isRejected(result) && result.payload?.data?.id) {
          postId.current = result.payload.data.id;
        }
      }
      return result;
    },
    [createPost, updatePost],
  );

  // Stable forever — reads state via refs, never recreated on keystroke
  const doAutoSave = useCallback(async () => {
    if (!titleRef.current.trim()) return;
    const result = await persistPost(buildPayload());
    if (!isRejected(result)) {
      setSavedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
  }, [persistPost, buildPayload]);

  const scheduleAutoSave = useAutoSave(doAutoSave);

  const handleSave = async () => {
    if (!titleRef.current.trim()) {
      showToast("Title is required", "error");
      return;
    }
    const result = await persistPost(buildPayload());
    if (!isRejected(result)) {
      setSavedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      showToast("Post saved successfully");
    } else {
      showToast(errorMsg(result), "error");
    }
  };

  const { publishPost, unpublishPost } = useBlog();

  const handlePublishToggle = async () => {
    if (!titleRef.current.trim()) {
      showToast("Title is required", "error");
      return;
    }
    const newStatus = statusRef.current === "published" ? "draft" : "published";

    // Step 1: if post doesn't exist yet, create it first
    if (!postId.current) {
      const createResult = await persistPost(buildPayload());
      if (isRejected(createResult)) {
        showToast(errorMsg(createResult), "error");
        return;
      }
    }

    // Step 2: save latest content without touching status
    const saveResult = await persistPost(buildPayload());
    if (isRejected(saveResult)) {
      showToast(errorMsg(saveResult), "error");
      return;
    }

    // Step 3: flip status via dedicated endpoint
    const statusResult =
      newStatus === "published"
        ? await publishPost(postId.current)
        : await unpublishPost(postId.current);

    if (!isRejected(statusResult)) {
      setStatus(newStatus);
      showToast(
        newStatus === "published" ? "Post published!" : "Moved to drafts",
      );
    } else {
      showToast(errorMsg(statusResult), "error");
    }
  };

  const initEditor = useCallback(() => {
    if (!window.tinymce || !editorTextarea.current) return;
    try {
      window.tinymce.remove("#tinymce-editor");
    } catch {}

    window.tinymce.init({
      target: editorTextarea.current,
      height: 460,
      menubar: false,
      plugins: [
        "advlist",
        "autolink",
        "lists",
        "link",
        "image",
        "charmap",
        "searchreplace",
        "visualblocks",
        "code",
        "fullscreen",
        "insertdatetime",
        "media",
        "table",
        "wordcount",
        "codesample",
      ],
      toolbar:
        "undo redo | styles | fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | blockquote codesample | link image media table | code fullscreen",
      toolbar_sticky: false,
      font_family_formats:
        "Lora=Lora,serif;Sora=Sora,sans-serif;Merriweather=Merriweather,serif;Playfair Display=Playfair Display,serif;Fira Code=Fira Code,monospace;Georgia=georgia,serif",
      font_size_formats:
        "11pt 12pt 13pt 14pt 15pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt",
      style_formats: [
        { title: "Paragraph", block: "p" },
        { title: "Heading 1", block: "h1" },
        { title: "Heading 2", block: "h2" },
        { title: "Heading 3", block: "h3" },
        { title: "Blockquote", block: "blockquote" },
      ],
      content_style: `
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Sora:wght@400;500;600;700&family=Fira+Code&display=swap');
        html,body{font-family:'Lora',serif;font-size:16.5px;line-height:1.85;color:#1f2937;background:#fff;margin:0;padding:24px 40px 48px}
        h1,h2,h3,h4{font-family:'Sora',sans-serif;font-weight:700;color:#111827;letter-spacing:-.025em;line-height:1.25;margin:1.4em 0 .45em}
        h1{font-size:2rem}h2{font-size:1.5rem}h3{font-size:1.2rem}p{margin:0 0 1.2em}
        a{color:#4F6EF7}blockquote{margin:1.5em 0;padding:13px 20px;border-left:3px solid #4F6EF7;background:#f8faff;border-radius:0 4px 4px 0;font-style:italic}
        code{background:#f3f4f6;padding:2px 6px;border-radius:3px;font-family:'Fira Code',monospace;font-size:.85em;color:#b45309}
        img{max-width:100%;border-radius:5px}ul,ol{padding-left:1.5em;margin:0 0 1.2em}
        table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:9px 13px}
        th{background:#f9fafb;font-family:'Sora',sans-serif;font-weight:600;font-size:.84em;text-transform:uppercase}
        ::selection{background:#e0e7ff}
      `,
      skin: "oxide",
      resize: false,
      statusbar: false,
      branding: false,
      promotion: false,
      images_upload_handler: (blobInfo) =>
        new Promise((res) => res(URL.createObjectURL(blobInfo.blob()))),
      file_picker_callback: (callback, _v, meta) => {
        if (meta.filetype === "image") {
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = "image/*";
          inp.onchange = () => {
            const file = inp.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) =>
              callback(e.target.result, { title: file.name });
            reader.readAsDataURL(file);
          };
          inp.click();
        }
      },
      setup(editor) {
        tinymce.current = editor;
        editor.on("init", () => {
          setReady(true);
          if (initialPost?.content) editor.setContent(initialPost.content);
        });
        editor.on("input change keyup SetContent", () => {
          const txt = editor.getContent({ format: "text" });
          const wc = txt.trim().split(/\s+/).filter(Boolean).length;
          setWordCount(wc);
          setReadTime(Math.max(1, Math.ceil(wc / 220)));
          scheduleAutoSave();
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPost]); // scheduleAutoSave is stable (zero state deps) — omitting it prevents re-init on every keystroke

  useEffect(() => {
    const existing = document.querySelector(`script[src="${TINYMCE_CDN}"]`);
    if (existing && window.tinymce) {
      initEditor();
      return;
    }
    if (existing) {
      existing.addEventListener("load", initEditor);
      return;
    }
    const s = document.createElement("script");
    s.src = TINYMCE_CDN;
    s.onload = initEditor;
    document.head.appendChild(s);
    return () => {
      try {
        tinymce.current?.destroy();
      } catch {}
    };
  }, [initEditor]);

  const handleTagKey = (e) => {
    if (["Enter", ","].includes(e.key) && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/,$/, "");
      if (t && !tags.includes(t) && tags.length < 10) setTags((p) => [...p, t]);
      setTagInput("");
    }
  };

  const handleCoverFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCoverImage(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const c = ev.target.result;
      if (tinymce.current) {
        tinymce.current.setContent(
          file.name.endsWith(".html")
            ? c
            : `<p>${c.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const openPreview = () => {
    setPreviewHTML(getContent());
    setShowPreview(true);
  };

  const exportHTML = () => {
    const content = getContent();
    const slug = (title || "blog-post")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title || "Blog Post"}</title></head><body>${content}</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    a.download = `${slug}.html`;
    a.click();
  };

  const checklist = [
    { label: "Title written", ok: title.trim().length > 3 },
    { label: "Subtitle / hook added", ok: subtitle.trim().length > 3 },
    { label: "Cover image set", ok: !!coverImage },
    { label: "Category selected", ok: !!category },
    { label: "At least one tag", ok: tags.length > 0 },
    { label: "Content (50+ words)", ok: wordCount >= 50 },
  ];
  const score = checklist.filter((c) => c.ok).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Lora:ital,wght@0,400;1,400&display=swap');
        .blog-editor-shell { height:100%;min-height:0;display:flex;flex-direction:column;font-family:'Sora',sans-serif;background:#fff;color:#111827 }
        .tox-tinymce{border:none!important;border-radius:0!important;box-shadow:none!important}
        .tox .tox-toolbar,.tox .tox-toolbar__primary{background:#fff!important;border-bottom:1px solid #f3f4f6!important;padding:4px 8px!important}
        .tox .tox-toolbar__group{border-right:1px solid #f0f0f0!important;padding:0 6px!important}
        .tox .tox-toolbar__group:last-child{border-right:none!important}
        .tox .tox-tbtn{border-radius:4px!important;width:28px!important;height:28px!important}
        .tox .tox-tbtn:hover{background:#f3f4f6!important}
        .tox .tox-tbtn--enabled{background:#e0e7ff!important}
        .tox .tox-tbtn--enabled svg{fill:#4F6EF7!important}
        .tox .tox-tbtn svg{fill:#4b5563!important}
        .tox-statusbar{display:none!important}
        .tox .tox-edit-area{border:none!important}
        .be-strip{height:48px;flex-shrink:0;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#fff}
        .be-tab{height:48px;padding:0 14px;border:none;background:transparent;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;transition:color .15s,border-color .15s}
        .be-tab.on{color:#111827;border-bottom-color:#4F6EF7}
        .be-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:5px;font-size:12.5px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}
        .be-btn-ghost{background:#fff;border:1px solid #e5e7eb;color:#374151}
        .be-btn-ghost:hover{background:#f9fafb;border-color:#d1d5db}
        .be-btn-primary{background:#4F6EF7;border:none;color:#fff;font-weight:600}
        .be-btn-primary:hover{background:#3d5ce8}
        .be-btn-success{background:#059669;border:none;color:#fff;font-weight:600}
        .be-btn-save{background:#111827;border:none;color:#fff;font-weight:600}
        .be-body{flex:1;min-height:0;display:flex;overflow:hidden}
        .be-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-right:1px solid #e5e7eb}
        .be-side{width:240px;flex-shrink:0;overflow-y:auto;padding:18px 15px;background:#fff}
        .be-title-zone{padding:22px 40px 0;border-bottom:1px solid #f3f4f6;flex-shrink:0}
        .be-title-input{width:100%;border:none;outline:none;resize:none;font-size:26px;font-weight:700;color:#111827;font-family:'Sora',sans-serif;background:transparent;letter-spacing:-.03em;line-height:1.25;overflow:hidden}
        .be-sub-input{width:100%;border:none;outline:none;resize:none;font-size:15px;color:#9ca3af;font-family:'Lora',serif;background:transparent;font-style:italic;line-height:1.6;overflow:hidden;padding-bottom:14px}
        .be-settings-scroll{flex:1;overflow-y:auto;padding:28px 40px;min-height:0}
        .s-label{font-size:10.5px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:9px;display:block}
        .s-div{border:none;border-top:1px solid #f3f4f6;margin:15px 0}
        .s-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
        .s-stat{background:#f9fafb;border:1px solid #f3f4f6;border-radius:5px;padding:9px 10px}
        .s-stat-val{font-size:17px;font-weight:700;color:#111827}
        .s-stat-lbl{font-size:10.5px;color:#9ca3af;margin-top:1px}
        .s-action{display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;color:#374151;font-size:12.5px;font-weight:500}
        .s-action:hover{color:#111827}
        .f-label{font-size:12.5px;font-weight:600;color:#374151;display:block;margin-bottom:7px}
        .f-input{width:100%;border:1px solid #e5e7eb;border-radius:5px;padding:8px 11px;font-size:13.5px;color:#111827;background:#fff;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
        .f-input:focus{border-color:#4F6EF7;box-shadow:0 0 0 3px rgba(79,110,247,.1)}
        .f-input::placeholder{color:#9ca3af}
        .drop-zone{border:2px dashed #e5e7eb;border-radius:6px;padding:28px 16px;text-align:center;cursor:pointer;transition:all .15s}
        .drop-zone:hover{border-color:#93c5fd;background:#f8faff}
        .be-status{height:30px;flex-shrink:0;border-top:1px solid #f3f4f6;display:flex;align-items:center;gap:18px;padding:0 16px;font-size:12px;color:#9ca3af;background:#fff}
        .spinner{width:20px;height:20px;border:2.5px solid #e5e7eb;border-top-color:#6b7280;border-radius:50%;animation:spin .65s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeup{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        .toast{position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 18px;border-radius:7px;font-size:13px;font-weight:500;font-family:'Sora',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.15);animation:fadeup .2s ease}
        .toast-success{background:#111827;color:#fff}
        .toast-error{background:#dc2626;color:#fff}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:10px}
      `}</style>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.txt"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />
      <input
        ref={coverFileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleCoverFile}
      />

      {showPreview && (
        <PreviewModal
          title={title}
          subtitle={subtitle}
          coverImage={coverImage}
          content={previewHTML}
          tags={tags}
          category={category}
          wordCount={wordCount}
          readTime={readTime}
          onClose={() => setShowPreview(false)}
        />
      )}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="blog-editor-shell">
        <div className="be-strip">
          <div style={{ display: "flex", alignItems: "stretch", height: 48 }}>
            <button
              className={`be-tab ${activeTab === "write" ? "on" : ""}`}
              onClick={() => setActiveTab("write")}
            >
              Write
            </button>
            <button
              className={`be-tab ${activeTab === "settings" ? "on" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              Post Settings
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {savedAt && (
              <span
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginRight: 4,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#10b981",
                    display: "inline-block",
                  }}
                />
                Saved {savedAt}
              </span>
            )}
            <button
              className="be-btn be-btn-ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Import
            </button>
            <button className="be-btn be-btn-ghost" onClick={exportHTML}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Export
            </button>
            <button className="be-btn be-btn-ghost" onClick={openPreview}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preview
            </button>
            <button
              className="be-btn be-btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className={`be-btn ${status === "published" ? "be-btn-success" : "be-btn-primary"}`}
              onClick={handlePublishToggle}
              disabled={saving}
            >
              {status === "published" ? "✓ Published" : "Publish"}
            </button>
          </div>
        </div>

        <div className="be-body">
          <div className="be-main">
            <div
              style={{ display: activeTab === "write" ? "contents" : "none" }}
            >
              <div className="be-title-zone">
                <textarea
                  className="be-title-input"
                  value={title}
                  rows={1}
                  placeholder="Post title"
                  onChange={(e) => {
                    setTitle(e.target.value);
                    scheduleAutoSave();
                  }}
                  onInput={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                />
                <textarea
                  className="be-sub-input"
                  value={subtitle}
                  rows={1}
                  placeholder="Add a subtitle…"
                  onChange={(e) => {
                    setSubtitle(e.target.value);
                    scheduleAutoSave();
                  }}
                  onInput={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                />
              </div>
              <div style={{ flexShrink: 0, background: "#fff" }}>
                {!ready && (
                  <div
                    style={{
                      height: 460,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      background: "#fff",
                    }}
                  >
                    <div className="spinner" />
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>
                      Loading editor…
                    </span>
                  </div>
                )}
                <div style={{ display: ready ? "block" : "none" }}>
                  <textarea ref={editorTextarea} id="tinymce-editor" />
                </div>
              </div>
            </div>

            {activeTab === "settings" && (
              <div
                className="be-settings-scroll"
                style={{ animation: "fadeup .2s ease" }}
              >
                <div style={{ maxWidth: 520 }}>
                  <div style={{ marginBottom: 24 }}>
                    <label className="f-label">Cover Image</label>
                    {coverImage ? (
                      <div
                        style={{
                          position: "relative",
                          borderRadius: 6,
                          overflow: "hidden",
                          marginBottom: 10,
                        }}
                      >
                        <img
                          src={coverImage}
                          alt="Cover"
                          style={{
                            width: "100%",
                            height: 190,
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                        <button
                          onClick={() => setCoverImage("")}
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            padding: "4px 10px",
                            background: "rgba(0,0,0,.6)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div
                        className="drop-zone"
                        onClick={() => coverFileRef.current?.click()}
                        style={{ marginBottom: 10 }}
                      >
                        <svg
                          width="26"
                          height="26"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#d1d5db"
                          strokeWidth="1.5"
                          style={{ margin: "0 auto 8px", display: "block" }}
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            fontWeight: 500,
                          }}
                        >
                          Click to upload
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            marginTop: 3,
                          }}
                        >
                          PNG, JPG, WebP — max 10 MB
                        </div>
                      </div>
                    )}
                    <label className="f-label">Or paste URL</label>
                    <input
                      className="f-input"
                      value={coverImage.startsWith("data:") ? "" : coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label className="f-label">Category</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {CATEGORIES.map((c) => (
                        <Chip
                          key={c.value}
                          active={category === c.value}
                          onClick={() =>
                            setCategory((x) => (x === c.value ? "" : c.value))
                          }
                        >
                          {c.label}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label className="f-label">
                      Tags{" "}
                      <span style={{ fontWeight: 400, color: "#9ca3af" }}>
                        ({tags.length}/10)
                      </span>
                    </label>
                    {tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 5,
                          marginBottom: 8,
                        }}
                      >
                        {tags.map((t) => (
                          <TagPill
                            key={t}
                            label={t}
                            onRemove={() =>
                              setTags((p) => p.filter((x) => x !== t))
                            }
                          />
                        ))}
                      </div>
                    )}
                    <input
                      className="f-input"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKey}
                      placeholder="Type a tag and press Enter…"
                    />
                    <div
                      style={{ fontSize: 12, color: "#9ca3af", marginTop: 5 }}
                    >
                      Separate with Enter or comma
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        marginBottom: 11,
                      }}
                    >
                      SEO Preview
                    </div>
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 5,
                        padding: "11px 13px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginBottom: 3,
                          fontFamily: "monospace",
                        }}
                      >
                        yoursite.com/blog/
                        {(title || "post-title")
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .slice(0, 30)}
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          color: "#1a0dab",
                          fontWeight: 600,
                          marginBottom: 3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {title || "Post Title"}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#4d5156",
                          lineHeight: 1.5,
                        }}
                      >
                        {subtitle ||
                          "Add a subtitle to improve your SEO description."}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: title.length > 60 ? "#dc2626" : "#9ca3af",
                        }}
                      >
                        Title: {title.length}/60
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: subtitle.length > 160 ? "#dc2626" : "#9ca3af",
                        }}
                      >
                        Desc: {subtitle.length}/160
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="be-side">
            <span className="s-label">Publish Checklist</span>
            {checklist.map((c) => (
              <CheckRow key={c.label} label={c.label} ok={c.ok} />
            ))}
            <div
              style={{
                background: "#f3f4f6",
                borderRadius: 3,
                height: 3,
                overflow: "hidden",
                margin: "9px 0 4px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: score === 6 ? "#10b981" : "#4F6EF7",
                  width: `${(score / 6) * 100}%`,
                  transition: "width .35s",
                  borderRadius: 3,
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#9ca3af",
                textAlign: "right",
                marginBottom: 2,
              }}
            >
              {score}/6 complete
            </div>

            <hr className="s-div" />
            <span className="s-label">Stats</span>
            <div className="s-stat-grid">
              {[
                { l: "Words", v: wordCount.toLocaleString() },
                { l: "Read", v: `${readTime}m` },
                { l: "Tags", v: tags.length },
                { l: "Title", v: `${title.length} ch` },
              ].map(({ l, v }) => (
                <div key={l} className="s-stat">
                  <div className="s-stat-val">{v}</div>
                  <div className="s-stat-lbl">{l}</div>
                </div>
              ))}
            </div>

            <hr className="s-div" />
            <span className="s-label">Actions</span>
            {[
              {
                d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
                label: "Preview post",
                fn: openPreview,
              },
              {
                d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
                label: "Export as HTML",
                fn: exportHTML,
              },
              {
                d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
                label: "Import file",
                fn: () => fileInputRef.current?.click(),
              },
              {
                d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
                label: "Upload cover",
                fn: () => coverFileRef.current?.click(),
              },
            ].map(({ d, label, fn }) => (
              <div key={label} className="s-action" onClick={fn}>
                <svg
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d={d} />
                </svg>
                {label}
              </div>
            ))}

            <hr className="s-div" />
            <span className="s-label">Status</span>
            <button
              onClick={handlePublishToggle}
              disabled={saving}
              style={{
                width: "100%",
                padding: "7px 12px",
                borderRadius: 5,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: status === "published" ? "#f0fdf4" : "#111827",
                border: status === "published" ? "1px solid #bbf7d0" : "none",
                color: status === "published" ? "#059669" : "#fff",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: status === "published" ? "#10b981" : "#4b5563",
                  display: "inline-block",
                }}
              />
              {saving
                ? "Saving…"
                : status === "published"
                  ? "Published — click to revert"
                  : "Publish post"}
            </button>
          </div>
        </div>

        <div className="be-status">
          <span>{wordCount.toLocaleString()} words</span>
          <span>{readTime} min read</span>
          {category && (
            <span style={{ color: "#374151", fontWeight: 500 }}>
              {CATEGORIES.find((c) => c.value === category)?.label || category}
            </span>
          )}
          {error && (
            <span style={{ color: "#dc2626" }}>
              {typeof error === "string"
                ? error
                : error?.message || "An error occurred"}
            </span>
          )}
          <span
            style={{
              marginLeft: "auto",
              fontWeight: 600,
              color: status === "published" ? "#059669" : "#9ca3af",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: status === "published" ? "#10b981" : "#d1d5db",
                display: "inline-block",
              }}
            />
            {status === "published" ? "Published" : "Draft"}
          </span>
        </div>
      </div>
    </>
  );
}
