const { pool } = require("../Config/database.config");
const { APIERR } = require("../Utils/index.utils");

const Hiring = {
  /**
   * Get all candidates with filters
   */
  async getCandidates(filters) {
    let db;
    try {
      db = await pool;

      const { search, role, location, minScore, page, limit } = filters;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      let whereConditions = ["ie.overall_score IS NOT NULL"];
      let params = [];

      if (search) {
        whereConditions.push(
          "(u.fullName LIKE ? OR u.skill LIKE ? OR u.email LIKE ?)",
        );
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (role) {
        whereConditions.push("u.skill LIKE ?");
        params.push(`%${role}%`);
      }

      if (location) {
        // Assuming location might be stored in user profile or derived
        // If not available, skip this filter
        // whereConditions.push("u.location LIKE ?");
        // params.push(`%${location}%`);
      }

      if (minScore > 0) {
        whereConditions.push("ie.overall_score >= ?");
        params.push(minScore);
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

      // Get total count
      const [countResult] = await db.execute(
        `SELECT COUNT(DISTINCT i.id) as total
         FROM interviews i
         INNER JOIN users u ON i.user_id = u.id
         INNER JOIN interview_evaluations ie ON i.id = ie.interview_id
         ${whereClause}`,
        params,
      );

      const total = countResult[0].total;

      // Get candidates with pagination
      const [candidates] = await db.execute(
        `SELECT 
           i.id as interview_id,
           i.user_id,
           i.created_at,
           u.fullName as name,
           u.email,
           u.skill,
           ie.overall_score,
           ie.hire_decision,
           ie.experience_level,
           ie.strengths,
           ie.weaknesses,
           ie.summary,
           (SELECT COUNT(*) FROM interview_questions WHERE interview_id = i.id) as total_questions,
           (SELECT GROUP_CONCAT(DISTINCT technology) 
            FROM interview_questions 
            WHERE interview_id = i.id AND technology IS NOT NULL) as technologies,
           (SELECT AVG(score) FROM question_evaluations WHERE interview_id = i.id) as avg_question_score,
           (SELECT GROUP_CONCAT(CONCAT(technology, ':', average_score, ':', level) SEPARATOR '||')
            FROM skill_evaluations 
            WHERE interview_id = i.id) as skill_scores
         FROM interviews i
         INNER JOIN users u ON i.user_id = u.id
         INNER JOIN interview_evaluations ie ON i.id = ie.interview_id
         ${whereClause}
         ORDER BY ie.overall_score DESC, i.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      // Get videos for each candidate
      const interviewIds = candidates.map((c) => c.interview_id);

      let videosMap = {};
      if (interviewIds.length > 0) {
        const placeholders = interviewIds.map(() => "?").join(",");
        const [videos] = await db.execute(
          `SELECT 
             interview_id,
             video_type,
             ftp_url,
             file_size,
             duration
           FROM interview_videos
           WHERE interview_id IN (${placeholders})
           AND upload_status = 'completed'
           AND ftp_url IS NOT NULL`,
          interviewIds,
        );

        videosMap = videos.reduce((acc, video) => {
          if (!acc[video.interview_id]) {
            acc[video.interview_id] = [];
          }
          acc[video.interview_id].push(video);
          return acc;
        }, {});
      }

      // Format candidates data
      const formattedCandidates = candidates.map((candidate) => {
        // Parse skill scores
        const skillScores = {};
        if (candidate.skill_scores) {
          candidate.skill_scores.split("||").forEach((skillData) => {
            const [tech, score, level] = skillData.split(":");
            skillScores[tech] = {
              score: parseFloat(score),
              level: level,
            };
          });
        }

        // Parse technologies and create skills array
        const technologies = candidate.technologies
          ? candidate.technologies.split(",")
          : [];
        const skills = technologies.map((tech) => ({
          name: tech,
          score: skillScores[tech]?.score || null,
          level: skillScores[tech]?.level || null,
        }));

        // Parse strengths and weaknesses (assuming they're JSON or comma-separated)
        let strengths = [];
        let weaknesses = [];
        try {
          strengths = candidate.strengths
            ? JSON.parse(candidate.strengths)
            : [];
        } catch {
          strengths = candidate.strengths
            ? candidate.strengths.split(",").map((s) => s.trim())
            : [];
        }
        try {
          weaknesses = candidate.weaknesses
            ? JSON.parse(candidate.weaknesses)
            : [];
        } catch {
          weaknesses = candidate.weaknesses
            ? candidate.weaknesses.split(",").map((s) => s.trim())
            : [];
        }

        return {
          id: candidate.interview_id,
          userId: candidate.user_id,
          name: candidate.name,
          email: candidate.email,
          role: candidate.skill || "Not specified",
          bio: candidate.summary || "",
          interviewScore: Math.round(candidate.overall_score),
          technicalScore: Math.round(candidate.avg_question_score || 0),
          culturalFit: candidate.hire_decision === "hire" ? 90 : 70, // Derive from hire decision
          experience: candidate.experience_level || "Not evaluated",
          skills: skills,
          allSkills: technologies,
          strengths: strengths,
          weaknesses: weaknesses,
          totalQuestions: candidate.total_questions,
          videos: videosMap[candidate.interview_id] || [],
          createdAt: candidate.created_at,
        };
      });

      return {
        candidates: formattedCandidates,
        total: total,
      };
    } catch (error) {
      console.error("❌ Error getting candidates:", error);
      throw error;
    } finally {
    }
  },

  /**
   * Get single candidate by interview ID
   */
  async getCandidateById(interviewId) {
    let db;
    try {
      db = pool;

      const [candidates] = await db.execute(
        `SELECT 
           i.id as interview_id,
           i.user_id,
           i.created_at,
           u.fullName as name,
           u.email,
           u.skill,
           ie.overall_score,
           ie.hire_decision,
           ie.experience_level,
           ie.strengths,
           ie.weaknesses,
           ie.summary,
           (SELECT COUNT(*) FROM interview_questions WHERE interview_id = i.id) as total_questions
         FROM interviews i
         INNER JOIN users u ON i.user_id = u.id
         LEFT JOIN interview_evaluations ie ON i.id = ie.interview_id
         WHERE i.id = ?
         LIMIT 1`,
        [interviewId],
      );

      if (candidates.length === 0) {
        return null;
      }

      const candidate = candidates[0];

      // Get questions and evaluations
      const [questions] = await db.execute(
        `SELECT 
           q.id,
           q.question,
           q.answer,
           q.technology,
           q.difficulty,
           q.question_order,
           qe.score,
           qe.correctness,
           qe.depth,
           qe.clarity,
           qe.feedback,
           qe.detected_level
         FROM interview_questions q
         LEFT JOIN question_evaluations qe ON q.id = qe.question_id
         WHERE q.interview_id = ?
         ORDER BY q.question_order ASC`,
        [interviewId],
      );

      // Get skill evaluations
      const [skillEvals] = await db.execute(
        `SELECT technology, average_score, level
         FROM skill_evaluations
         WHERE interview_id = ?`,
        [interviewId],
      );

      // Get videos
      const [videos] = await db.execute(
        `SELECT video_type, ftp_url, file_size, duration
         FROM interview_videos
         WHERE interview_id = ?
         AND upload_status = 'completed'
         AND ftp_url IS NOT NULL`,
        [interviewId],
      );

      // Parse strengths and weaknesses
      let strengths = [];
      let weaknesses = [];
      try {
        strengths = candidate.strengths ? JSON.parse(candidate.strengths) : [];
      } catch {
        strengths = candidate.strengths
          ? candidate.strengths.split(",").map((s) => s.trim())
          : [];
      }
      try {
        weaknesses = candidate.weaknesses
          ? JSON.parse(candidate.weaknesses)
          : [];
      } catch {
        weaknesses = candidate.weaknesses
          ? candidate.weaknesses.split(",").map((s) => s.trim())
          : [];
      }

      // Format skills
      const skills = skillEvals.map((skill) => ({
        name: skill.technology,
        score: skill.average_score,
        level: skill.level,
      }));

      const allSkills = skillEvals.map((s) => s.technology);

      return {
        id: candidate.interview_id,
        userId: candidate.user_id,
        name: candidate.name,
        email: candidate.email,
        role: candidate.skill || "Not specified",
        bio: candidate.summary || "",
        interviewScore: Math.round(candidate.overall_score || 0),
        technicalScore: Math.round(
          skillEvals.reduce((sum, s) => sum + s.average_score, 0) /
            (skillEvals.length || 1),
        ),
        culturalFit: candidate.hire_decision === "hire" ? 90 : 70,
        experience: candidate.experience_level || "Not evaluated",
        skills: skills,
        allSkills: allSkills,
        strengths: strengths,
        weaknesses: weaknesses,
        totalQuestions: candidate.total_questions,
        questions: questions,
        videos: videos,
        createdAt: candidate.created_at,
        hireDecision: candidate.hire_decision,
      };
    } catch (error) {
      console.error("❌ Error getting candidate by ID:", error);
      throw error;
    } finally {
    }
  },

  /**
   * Get hiring statistics
   */
  async getHiringStats() {
    let db;
    try {
      db = pool;

      const [stats] = await db.execute(
        `SELECT 
           COUNT(DISTINCT i.id) as total_candidates,
           COUNT(DISTINCT CASE WHEN ie.hire_decision = 'hire' THEN i.id END) as recommended_hires,
           AVG(ie.overall_score) as avg_score,
           COUNT(DISTINCT CASE WHEN ie.overall_score >= 80 THEN i.id END) as high_performers
         FROM interviews i
         INNER JOIN interview_evaluations ie ON i.id = ie.interview_id`,
      );

      return stats[0];
    } catch (error) {
      console.error("❌ Error getting hiring stats:", error);
      throw error;
    } finally {
    }
  },
};

module.exports = { Hiring };
