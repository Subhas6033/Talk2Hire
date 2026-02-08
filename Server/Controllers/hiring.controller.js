const { Hiring } = require("../Models/hiring.models");
const { APIERR } = require("../Utils/index.utils");

const HiringController = {
  /**
   * Get all completed interviews with evaluations
   * GET /api/hiring/candidates
   */
  async getCandidates(req, res) {
    try {
      const {
        search = "",
        role = "",
        location = "",
        minScore = 0,
        page = 1,
        limit = 50,
      } = req.query;

      const filters = {
        search: search.trim(),
        role: role.trim(),
        location: location.trim(),
        minScore: parseInt(minScore),
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const result = await Hiring.getCandidates(filters);

      res.status(200).json({
        success: true,
        data: result.candidates,
        pagination: {
          total: result.total,
          page: filters.page,
          limit: filters.limit,
          totalPages: Math.ceil(result.total / filters.limit),
        },
      });
    } catch (error) {
      console.error("❌ Error in getCandidates:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to fetch candidates",
      });
    }
  },

  /**
   * Get single candidate details
   * GET /api/hiring/candidates/:interviewId
   */
  async getCandidateDetails(req, res) {
    try {
      const { interviewId } = req.params;

      if (!interviewId) {
        throw new APIERR(400, "Interview ID is required");
      }

      const candidate = await Hiring.getCandidateById(interviewId);

      if (!candidate) {
        throw new APIERR(404, "Candidate not found");
      }

      res.status(200).json({
        success: true,
        data: candidate,
      });
    } catch (error) {
      console.error("❌ Error in getCandidateDetails:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to fetch candidate details",
      });
    }
  },

  /**
   * Get candidate statistics
   * GET /api/hiring/stats
   */
  async getHiringStats(req, res) {
    try {
      const stats = await Hiring.getHiringStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("❌ Error in getHiringStats:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to fetch hiring stats",
      });
    }
  },
};

module.exports = HiringController;
