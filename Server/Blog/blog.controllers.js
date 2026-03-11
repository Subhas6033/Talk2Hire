const BlogModel = require("./blog.models.js");
const {
  uploadFileToFTP,
  deleteFileFromFTP,
} = require("../Upload/uploadOnFTP.js");

const isBase64Image = (str) =>
  typeof str === "string" && str.startsWith("data:");

const extractBase64Parts = (dataUrl) => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) return null;
  return { mimeType: matches[1], data: matches[2] };
};

const mimeToExt = (mime) => {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] || "jpg";
};

const uploadCoverImage = async (base64DataUrl, postTitle = "cover") => {
  const parts = extractBase64Parts(base64DataUrl);
  if (!parts) return null;

  const ext = mimeToExt(parts.mimeType);
  const safeName = postTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 40);
  const fileName = `${safeName}-${Date.now()}.${ext}`;
  const fileBuffer = Buffer.from(parts.data, "base64");

  const result = await uploadFileToFTP(
    fileBuffer,
    fileName,
    "/public/blogs-image",
  );
  return result.url;
};

const BlogController = {
  async createPost(req, res) {
    try {
      const authorId = req.admin?.id;
      if (!authorId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });

      const { title } = req.body;
      if (!title?.trim())
        return res
          .status(400)
          .json({ success: false, message: "Title is required" });

      const body = { ...req.body };

      // Guard: strip invalid category values so they never hit the DB ENUM
      const VALID_CATEGORIES = [
        "interview",
        "career",
        "ai",
        "salary",
        "resume",
      ];
      if (
        body.category !== undefined &&
        body.category !== null &&
        body.category !== "" &&
        !VALID_CATEGORIES.includes(body.category)
      ) {
        console.warn(
          `createPost: invalid category '${body.category}' stripped`,
        );
        body.category = null;
      }

      if (isBase64Image(body.cover_image)) {
        try {
          body.cover_image = await uploadCoverImage(body.cover_image, title);
        } catch (ftpErr) {
          console.error("Cover image upload failed:", ftpErr.message);
          body.cover_image = null;
        }
      }

      const result = await BlogModel.create(body, authorId);
      return res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: result,
      });
    } catch (err) {
      console.error("createPost error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async getAllPosts(req, res) {
    try {
      const { status, category, search, sortBy, page, limit } = req.query;
      const result = await BlogModel.findAll({
        status,
        category,
        search,
        sortBy,
        page,
        limit,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("getAllPosts error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async getStats(req, res) {
    try {
      const stats = await BlogModel.getStats();
      return res.status(200).json({ success: true, data: stats });
    } catch (err) {
      console.error("getStats error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async getPostById(req, res) {
    try {
      const post = await BlogModel.findById(req.params.id);
      if (!post)
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      return res.status(200).json({ success: true, data: post });
    } catch (err) {
      console.error("getPostById error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async getPostBySlug(req, res) {
    try {
      const post = await BlogModel.findBySlug(req.params.slug);
      if (!post)
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      await BlogModel.incrementViews(post.id);
      return res.status(200).json({ success: true, data: post });
    } catch (err) {
      console.error("getPostBySlug error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async updatePost(req, res) {
    try {
      const { id } = req.params;
      const post = await BlogModel.findById(id);
      if (!post)
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });

      const body = { ...req.body };

      // Strip status from a plain update — status changes go through /publish and /unpublish only
      delete body.status;

      // Guard: strip invalid category values so they never hit the DB ENUM
      const VALID_CATEGORIES = [
        "interview",
        "career",
        "ai",
        "salary",
        "resume",
      ];
      if (
        body.category !== undefined &&
        body.category !== null &&
        body.category !== "" &&
        !VALID_CATEGORIES.includes(body.category)
      ) {
        console.warn(
          `updatePost: invalid category '${body.category}' stripped`,
        );
        delete body.category; // don't update category if value is invalid
      }

      if (isBase64Image(body.cover_image)) {
        try {
          body.cover_image = await uploadCoverImage(
            body.cover_image,
            body.title || post.title,
          );
        } catch (ftpErr) {
          console.error("Cover image upload failed:", ftpErr.message);
          body.cover_image = post.cover_image;
        }
      }

      const updated = await BlogModel.update(id, body);
      if (!updated)
        return res
          .status(400)
          .json({ success: false, message: "Nothing to update" });

      const refreshed = await BlogModel.findById(id);
      return res.status(200).json({
        success: true,
        message: "Post updated successfully",
        data: { slug: refreshed.slug, cover_image: refreshed.cover_image },
      });
    } catch (err) {
      console.error("updatePost error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async publishPost(req, res) {
    try {
      await BlogModel.update(req.params.id, { status: "published" });
      return res.status(200).json({ success: true, message: "Post published" });
    } catch (err) {
      console.error("publishPost error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async unpublishPost(req, res) {
    try {
      await BlogModel.update(req.params.id, { status: "draft" });
      return res
        .status(200)
        .json({ success: true, message: "Post moved to drafts" });
    } catch (err) {
      console.error("unpublishPost error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async softDeletePost(req, res) {
    try {
      const deleted = await BlogModel.softDelete(req.params.id);
      if (!deleted)
        return res.status(404).json({
          success: false,
          message: "Post not found or already deleted",
        });
      return res
        .status(200)
        .json({ success: true, message: "Post moved to trash" });
    } catch (err) {
      console.error("softDeletePost error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async restorePost(req, res) {
    try {
      const restored = await BlogModel.restore(req.params.id);
      if (!restored)
        return res
          .status(404)
          .json({ success: false, message: "Post not found in trash" });
      return res
        .status(200)
        .json({ success: true, message: "Post restored to drafts" });
    } catch (err) {
      console.error("restorePost error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async permanentDeletePost(req, res) {
    try {
      const deleted = await BlogModel.permanentDelete(req.params.id);
      if (!deleted)
        return res
          .status(404)
          .json({ success: false, message: "Post not found in trash" });
      return res
        .status(200)
        .json({ success: true, message: "Post permanently deleted" });
    } catch (err) {
      console.error("permanentDeletePost error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async emptyTrash(req, res) {
    try {
      const count = await BlogModel.emptyTrash();
      return res.status(200).json({
        success: true,
        message: `${count} post(s) permanently deleted`,
        deleted: count,
      });
    } catch (err) {
      console.error("emptyTrash error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
};

module.exports = { BlogController };
