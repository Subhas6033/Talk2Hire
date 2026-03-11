const BlogModel = require("./blog.models.js");

const PublicBlogController = {
  async getAllPublishedPosts(req, res) {
    try {
      const { category, search, sortBy, page, limit } = req.query;

      const result = await BlogModel.findAll({
        status: "published",
        category,
        search,
        sortBy,
        page,
        limit,
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("getAllPublishedPosts error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async getPublishedPostBySlug(req, res) {
    try {
      const post = await BlogModel.findPublishedBySlug(req.params.slug);

      if (!post)
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });

      await BlogModel.incrementViews(post.id);

      return res.status(200).json({ success: true, data: post });
    } catch (err) {
      console.error("getPublishedPostBySlug error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async getPublishedPostsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { sortBy, page, limit } = req.query;

      const result = await BlogModel.findAll({
        status: "published",
        category,
        sortBy,
        page,
        limit,
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("getPublishedPostsByCategory error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async getRelatedPosts(req, res) {
    try {
      const post = await BlogModel.findPublishedBySlug(req.params.slug);

      if (!post)
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });

      const related = await BlogModel.findRelated(post.id, post.category);

      return res.status(200).json({ success: true, data: related });
    } catch (err) {
      console.error("getRelatedPosts error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
};

module.exports = { PublicBlogController };
