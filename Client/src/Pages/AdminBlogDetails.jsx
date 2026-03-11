import { useState, useMemo } from "react";
import { useBlog } from "../Hooks/useBlogHook";

const CATEGORY_COLORS = {
  Technology: { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6" },
  Design: { bg: "#fdf4ff", text: "#9333ea", dot: "#a855f7" },
  Lifestyle: { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e" },
  Travel: { bg: "#fff7ed", text: "#ea580c", dot: "#f97316" },
  Business: { bg: "#fafafa", text: "#374151", dot: "#6b7280" },
  Health: { bg: "#ecfdf5", text: "#059669", dot: "#10b981" },
  Science: { bg: "#f0f9ff", text: "#0284c7", dot: "#0ea5e9" },
  Culture: { bg: "#fef9c3", text: "#ca8a04", dot: "#eab308" },
};

const STATUS_CONFIG = {
  published: {
    label: "Published",
    bg: "#f0fdf4",
    text: "#16a34a",
    border: "#bbf7d0",
    dot: "#22c55e",
  },
  draft: {
    label: "Draft",
    bg: "#fafafa",
    text: "#6b7280",
    border: "#e5e7eb",
    dot: "#9ca3af",
  },
  deleted: {
    label: "Deleted",
    bg: "#fff1f2",
    text: "#e11d48",
    border: "#fecdd3",
    dot: "#f43f5e",
  },
};

function Avatar({ name = "" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colors = [
    "#4F6EF7",
    "#7C3AED",
    "#059669",
    "#ea580c",
    "#0284c7",
    "#ca8a04",
  ];
  const idx = (initials.charCodeAt(0) || 0) % colors.length;
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: colors[idx] + "20",
        color: colors[idx],
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials || "?"}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px",
        borderRadius: 4,
        fontSize: 11.5,
        fontWeight: 600,
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: s.dot,
          display: "inline-block",
        }}
      />
      {s.label}
    </span>
  );
}

function CategoryBadge({ category }) {
  const c = CATEGORY_COLORS[category] || {
    bg: "#f3f4f6",
    text: "#374151",
    dot: "#6b7280",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
      }}
    >
      <span
        style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }}
      />
      {category}
    </span>
  );
}

function Dropdown({ items, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 4px)",
        zIndex: 50,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
        minWidth: 160,
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item === "divider" ? (
          <div
            key={i}
            style={{ height: 1, background: "#f3f4f6", margin: "3px 0" }}
          />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.fn();
              onClose();
            }}
            style={{
              width: "100%",
              padding: "8px 14px",
              border: "none",
              background: "transparent",
              textAlign: "left",
              fontSize: 13,
              color: item.danger ? "#dc2626" : "#374151",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = item.danger
                ? "#fff1f2"
                : "#f9fafb")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {item.icon}
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

function PostRow({
  post,
  onEdit,
  onDelete,
  onRestore,
  onPublish,
  onUnpublish,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tags = Array.isArray(post.tags)
    ? post.tags
    : post.tags
      ? JSON.parse(post.tags)
      : [];

  const menuItems = [
    {
      label: "Edit post",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      fn: () => onEdit(post),
    },
    ...(post.status === "published"
      ? [
          {
            label: "Unpublish",
            icon: (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ),
            fn: () => onUnpublish(post.id),
          },
        ]
      : []),
    ...(post.status === "draft"
      ? [
          {
            label: "Publish",
            icon: (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ),
            fn: () => onPublish(post.id),
          },
        ]
      : []),
    ...(post.status === "deleted"
      ? [
          {
            label: "Restore",
            icon: (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
            ),
            fn: () => onRestore(post.id),
          },
        ]
      : []),
    "divider",
    {
      label: post.status === "deleted" ? "Delete permanently" : "Move to trash",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      ),
      fn: () => onDelete(post.id),
      danger: true,
    },
  ];

  return (
    <tr
      style={{
        borderBottom: "1px solid #f3f4f6",
        transition: "background .12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td style={{ padding: "14px 16px", maxWidth: 340 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 36,
              borderRadius: 5,
              flexShrink: 0,
              background: "linear-gradient(135deg, #e0e7ff, #f3f4f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {post.cover_image ? (
              <img
                src={post.cover_image}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#c7d2fe"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "#111827",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 260,
                lineHeight: 1.35,
                marginBottom: 3,
              }}
            >
              {post.title}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {post.category && <CategoryBadge category={post.category} />}
              {tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 500 }}
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 16px" }}>
        <StatusBadge status={post.status} />
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Avatar name={post.author_name || "Admin"} />
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
            {post.author_name || "Admin"}
          </span>
        </div>
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          {new Date(post.updated_at).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
          {post.read_time} min · {(post.word_count || 0).toLocaleString()} words
        </div>
      </td>
      <td style={{ padding: "14px 16px" }}>
        {post.status === "published" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                fontSize: 12,
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
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
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {(post.views || 0).toLocaleString()}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
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
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              {post.comments_count || 0}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
        )}
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              width: 28,
              height: 28,
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              background: menuOpen ? "#f3f4f6" : "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
                onClick={() => setMenuOpen(false)}
              />
              <Dropdown items={menuItems} onClose={() => setMenuOpen(false)} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function EmptyState({ tab, onCreate }) {
  const cfg = {
    all: {
      icon: "📝",
      msg: "No posts yet",
      sub: "Create your first post to get started.",
    },
    published: {
      icon: "🚀",
      msg: "Nothing published yet",
      sub: "Publish a draft to see it here.",
    },
    draft: {
      icon: "✏️",
      msg: "No drafts",
      sub: "Start writing and save as draft.",
    },
    deleted: {
      icon: "🗑️",
      msg: "Trash is empty",
      sub: "Deleted posts will appear here.",
    },
  };
  const { icon, msg, sub } = cfg[tab] || cfg.all;
  return (
    <div style={{ padding: "64px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        {msg}
      </div>
      <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
        {sub}
      </div>
      {tab !== "deleted" && (
        <button
          onClick={onCreate}
          style={{
            padding: "8px 20px",
            border: "none",
            borderRadius: 6,
            background: "#4F6EF7",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Write a post
        </button>
      )}
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,.4)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "28px 28px 22px",
          width: 360,
          boxShadow: "0 20px 50px rgba(0,0,0,.18)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#fff1f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e11d48"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          Confirm deletion
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "#6b7280",
            lineHeight: 1.55,
            marginBottom: 22,
          }}
        >
          {message}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "7px 18px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              background: "#fff",
              color: "#374151",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "7px 18px",
              border: "none",
              borderRadius: 6,
              background: "#dc2626",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBlogDetails({ onCreateNew, onEditPost }) {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [confirmDialog, setConfirmDialog] = useState(null);

  const queryParams = useMemo(
    () => ({
      status: activeTab === "all" ? undefined : activeTab,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      search: search.trim() || undefined,
      sortBy,
      limit: 50,
    }),
    [activeTab, categoryFilter, search, sortBy],
  );

  const {
    posts,
    stats,
    loading,
    publishPost,
    unpublishPost,
    softDeletePost,
    restorePost,
    permanentDeletePost,
    emptyTrash,
  } = useBlog(queryParams);

  const counts = {
    all: Number(stats.total) - Number(stats.deleted),
    published: Number(stats.published),
    draft: Number(stats.draft),
    deleted: Number(stats.deleted),
  };

  const handleDelete = (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.status === "deleted") {
      setConfirmDialog({ postId, permanent: true });
    } else {
      softDeletePost(postId);
    }
  };

  const handlePermanentDelete = async () => {
    await permanentDeletePost(confirmDialog.postId);
    setConfirmDialog(null);
  };

  const categories = [
    "all",
    ...Array.from(new Set(posts.map((p) => p.category).filter(Boolean))),
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');
        .blog-page { padding: 28px 32px; font-family: 'Sora', sans-serif; color: #111827; background: #fff; min-height: 100%; }
        .bp-stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; }
        .bp-stat-val { font-size: 24px; font-weight: 700; }
        .bp-stat-sub { font-size: 11px; color: #9ca3af; margin-top: 6px; }
        .tab-pill { padding: 5px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; border: none; background: transparent; cursor: pointer; color: #6b7280; font-family: inherit; transition: all .15s; display: inline-flex; align-items: center; gap: 6px; }
        .tab-pill.on { background: #f0f0ff; color: #4F6EF7; font-weight: 600; }
        .tab-pill:hover:not(.on) { background: #f9fafb; color: #374151; }
        .cnt-badge { font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 10px; background: #e5e7eb; color: #6b7280; }
        .tab-pill.on .cnt-badge { background: #e0e7ff; color: #4F6EF7; }
        .be-search { height: 34px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0 10px 0 32px; font-size: 13px; color: #111827; background: #fff; font-family: inherit; outline: none; width: 220px; transition: border-color .15s, box-shadow .15s; }
        .be-search:focus { border-color: #4F6EF7; box-shadow: 0 0 0 3px rgba(79,110,247,.1); }
        .be-search::placeholder { color: #9ca3af; }
        .be-select { height: 34px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0 10px; font-size: 13px; color: #374151; background: #fff; font-family: inherit; outline: none; cursor: pointer; }
        .create-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 18px; border: none; border-radius: 7px; background: #4F6EF7; color: #fff; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; box-shadow: 0 1px 4px rgba(79,110,247,.3); transition: all .15s; }
        .create-btn:hover { background: #3d5ce8; transform: translateY(-1px); }
        .create-btn:active { transform: none; }
        table { width: 100%; border-collapse: collapse; }
        thead th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
        @keyframes fadeup { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: none; } }
        .blog-page { animation: fadeup .25s ease; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .skeleton { background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 4px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      {confirmDialog && (
        <ConfirmDialog
          message="This will permanently delete the post and cannot be undone."
          onConfirm={handlePermanentDelete}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      <div className="blog-page">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
                letterSpacing: "-.025em",
                marginBottom: 3,
              }}
            >
              Blog
            </h1>
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              Manage and publish your blog posts
            </p>
          </div>
          <button className="create-btn" onClick={onCreateNew}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Post
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {[
            {
              label: "Total Posts",
              value: Number(stats.total),
              sub: `${counts.all} active`,
              icon: "📝",
              color: "#4F6EF7",
            },
            {
              label: "Published",
              value: counts.published,
              sub: `${Math.round((counts.published / Math.max(counts.all, 1)) * 100)}% of active`,
              icon: "🚀",
              color: "#059669",
            },
            {
              label: "Total Views",
              value: Number(stats.total_views).toLocaleString(),
              sub: "across published posts",
              icon: "👁️",
              color: "#ea580c",
            },
            {
              label: "Total Words",
              value:
                Number(stats.total_words) >= 1000
                  ? `${(Number(stats.total_words) / 1000).toFixed(1)}k`
                  : Number(stats.total_words),
              sub: "across all active posts",
              icon: "✍️",
              color: "#7C3AED",
            },
          ].map(({ label, value, sub, icon, color }) => (
            <div key={label} className="bp-stat-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                  }}
                >
                  {label}
                </span>
                <span style={{ fontSize: 18 }}>{icon}</span>
              </div>
              <div className="bp-stat-val" style={{ color }}>
                {value}
              </div>
              <div className="bp-stat-sub">{sub}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,.04)",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[
                { id: "all", label: "All", count: counts.all },
                {
                  id: "published",
                  label: "Published",
                  count: counts.published,
                },
                { id: "draft", label: "Drafts", count: counts.draft },
                { id: "deleted", label: "Trash", count: counts.deleted },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`tab-pill ${activeTab === t.id ? "on" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                  <span className="cnt-badge">{t.count}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  className="be-search"
                  placeholder="Search posts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="be-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All categories" : c}
                  </option>
                ))}
              </select>
              <select
                className="be-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="updatedAt">Last updated</option>
                <option value="createdAt">Date created</option>
                <option value="title">Title A–Z</option>
                <option value="views">Most viewed</option>
                <option value="wordCount">Word count</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "16px" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 56, marginBottom: 8 }}
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <EmptyState tab={activeTab} onCreate={onCreateNew} />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Status</th>
                    <th>Author</th>
                    <th>Updated</th>
                    <th>Engagement</th>
                    <th style={{ width: 48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <PostRow
                      key={post.id}
                      post={post}
                      onEdit={onEditPost || (() => {})}
                      onDelete={handleDelete}
                      onRestore={restorePost}
                      onPublish={publishPost}
                      onUnpublish={unpublishPost}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {posts.length > 0 && (
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid #f3f4f6",
                fontSize: 12,
                color: "#9ca3af",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>
                Showing {posts.length} post{posts.length !== 1 ? "s" : ""}
              </span>
              {activeTab === "deleted" && (
                <button
                  onClick={emptyTrash}
                  style={{
                    fontSize: 12,
                    color: "#dc2626",
                    fontWeight: 500,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Empty trash
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
