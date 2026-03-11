const express = require("express");
const router = express.Router();
const { BlogController } = require("./blog.controllers.js");
const { PublicBlogController } = require("./userBlog.controllers.js");
const { adminAuthMiddleware } = require("../Middlewares/auth.middlewares.js");

// Public routes
router.get("/public/posts", PublicBlogController.getAllPublishedPosts);
router.get(
  "/public/posts/category/:category",
  PublicBlogController.getPublishedPostsByCategory,
);
router.get("/public/posts/related/:slug", PublicBlogController.getRelatedPosts);
router.get("/public/posts/:slug", PublicBlogController.getPublishedPostBySlug);

// Admin routes
router.use(adminAuthMiddleware);

router.get("/stats", BlogController.getStats);
router.get("/posts", BlogController.getAllPosts);
router.get("/posts/slug/:slug", BlogController.getPostBySlug);
router.get("/posts/:id", BlogController.getPostById);
router.post("/posts", BlogController.createPost);
router.put("/posts/:id", BlogController.updatePost);
router.patch("/posts/:id/publish", BlogController.publishPost);
router.patch("/posts/:id/unpublish", BlogController.unpublishPost);
router.patch("/posts/:id/restore", BlogController.restorePost);
router.delete("/trash/empty", BlogController.emptyTrash);
router.delete("/posts/:id/soft", BlogController.softDeletePost);
router.delete("/posts/:id/permanent", BlogController.permanentDeletePost);

module.exports = router;
