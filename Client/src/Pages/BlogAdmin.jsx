import { useState } from "react";
import BlogPage from "./AdminBlogDetails";
import BlogEditor from "./AdminBlogPost";
import BlogArticle from "./BlogArticle";

export default function BlogAdmin() {
  const [view, setView] = useState("list"); // "list" | "editor" | "preview"
  const [editingPost, setEditingPost] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  const openEditor = (post = null) => {
    setEditingPost(post);
    setView("editor");
  };

  const backToList = () => {
    setEditingPost(null);
    setView("list");
  };

  // Called from BlogEditor's Preview button — receives live draft data
  const openPreview = (draftPost) => {
    setPreviewData(draftPost);
    setView("preview");
  };

  const backToEditor = () => {
    setPreviewData(null);
    setView("editor");
  };

  // ── Preview ────────────────────────────────────────────────────────────────
  if (view === "preview") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Preview chrome bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            background: "#111827",
            flexShrink: 0,
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10b981",
                display: "inline-block",
              }}
            />
            <span
              style={{ color: "#9ca3af", fontSize: 13, fontFamily: "inherit" }}
            >
              Preview Mode —{" "}
              <span style={{ color: "#d1d5db", fontWeight: 500 }}>
                {previewData?.title || "Untitled"}
              </span>
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                background: "#374151",
                color: "#9ca3af",
                fontWeight: 500,
              }}
            >
              Draft
            </span>
          </div>
          <button
            onClick={backToEditor}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 14px",
              border: "1px solid #374151",
              borderRadius: 6,
              background: "transparent",
              color: "#d1d5db",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Editor
          </button>
        </div>

        {/* Scrollable preview area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            background: "#fff",
          }}
        >
          <BlogArticle
            post={previewData}
            onBack={backToEditor}
            relatedPosts={[]}
            isPreview
          />
        </div>
      </div>
    );
  }

  // ── Editor ─────────────────────────────────────────────────────────────────
  if (view === "editor") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 20px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <button
            onClick={backToList}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Blog
          </button>
          <span style={{ fontSize: 13, color: "#9ca3af" }}>
            {editingPost ? `Editing: ${editingPost.title}` : "New Post"}
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <BlogEditor
            initialPost={editingPost}
            onBack={backToList}
            onPreview={openPreview}
          />
        </div>
      </div>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <BlogPage
      onCreateNew={() => openEditor(null)}
      onEditPost={(post) => openEditor(post)}
    />
  );
}
