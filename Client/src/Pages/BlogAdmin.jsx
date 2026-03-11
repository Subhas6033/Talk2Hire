import { useState } from "react";
import BlogPage from "./AdminBlogDetails";
import BlogEditor from "./AdminBlogPost";

export default function BlogAdmin() {
  const [view, setView] = useState("list"); // "list" | "editor"
  const [editingPost, setEditingPost] = useState(null);

  const openEditor = (post = null) => {
    setEditingPost(post);
    setView("editor");
  };

  const backToList = () => {
    setEditingPost(null);
    setView("list");
  };

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
          <BlogEditor initialPost={editingPost} onBack={backToList} />
        </div>
      </div>
    );
  }

  return (
    <BlogPage
      onCreateNew={() => openEditor(null)}
      onEditPost={(post) => openEditor(post)}
    />
  );
}
