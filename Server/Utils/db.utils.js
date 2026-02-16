const userTableQuery = `
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fullName VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashPassword VARCHAR(255) NOT NULL,
    resume VARCHAR(500),
    resume_upload_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    cv_extracted_skills JSON,
    interview_selected_skills JSON,
    refreshToken TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;

const interviewTableQuery = `
CREATE TABLE IF NOT EXISTS interviews (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
);
`;

const interviewQuestionsTableQuery = `
CREATE TABLE IF NOT EXISTS interview_questions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    interview_id INT UNSIGNED NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    technology VARCHAR(255),
    difficulty VARCHAR(50),
    question_order INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Prevent duplicate question orders within the same interview
    UNIQUE KEY unique_interview_question_order (interview_id, question_order),

    -- Foreign key constraint
    FOREIGN KEY (interview_id)
      REFERENCES interviews(id)
      ON DELETE CASCADE,

    -- Index for faster lookups by order
    INDEX idx_interview_order (interview_id, question_order),
    
    -- Index for finding answered questions
    INDEX idx_interview_answered (interview_id, answer(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const questionEvaluationsTableQuery = `
CREATE TABLE IF NOT EXISTS question_evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    interview_id INT UNSIGNED NOT NULL,
    question_id INT UNSIGNED NOT NULL,

    score DECIMAL(4,2),           -- 0.00 – 10.00
    correctness DECIMAL(4,2),
    depth DECIMAL(4,2),
    clarity DECIMAL(4,2),

    feedback TEXT,
    detected_level ENUM('BEGINNER','INTERMEDIATE','ADVANCED'),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_question_eval (question_id),

    FOREIGN KEY (interview_id)
      REFERENCES interviews(id)
      ON DELETE CASCADE,

    FOREIGN KEY (question_id)
      REFERENCES interview_questions(id)
      ON DELETE CASCADE,

    INDEX idx_interview_eval (interview_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const interviewEvaluationsTableQuery = `
CREATE TABLE IF NOT EXISTS interview_evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    interview_id INT UNSIGNED NOT NULL,

    overall_score DECIMAL(5,2),   -- 0 – 100
    hire_decision ENUM('YES','NO','MAYBE'),
    experience_level ENUM('BEGINNER','INTERMEDIATE','ADVANCED'),

    strengths TEXT,
    weaknesses TEXT,
    summary TEXT,

    evaluated_by ENUM('AI','HUMAN') DEFAULT 'AI',
    model_version VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_interview_eval (interview_id),

    FOREIGN KEY (interview_id)
      REFERENCES interviews(id)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const skillEvaluationsTableQuery = `
CREATE TABLE IF NOT EXISTS skill_evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    interview_id INT UNSIGNED NOT NULL,
    technology VARCHAR(255) NOT NULL,

    average_score DECIMAL(4,2),
    level ENUM('BEGINNER','INTERMEDIATE','ADVANCED'),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_interview_skill (interview_id, technology),

    FOREIGN KEY (interview_id)
      REFERENCES interviews(id)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const interviewVideosTableQuery = `
CREATE TABLE IF NOT EXISTS interview_videos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    interview_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    
    video_type ENUM('primary_camera', 'security_camera', 'screen_recording') NOT NULL,
    
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    duration INT UNSIGNED,
    
    ftp_path VARCHAR(500) NOT NULL,
    ftp_url VARCHAR(500) NOT NULL,
    
    upload_status ENUM('pending', 'uploading', 'merging', 'completed', 'failed') DEFAULT 'pending',
    upload_progress TINYINT UNSIGNED DEFAULT 0,
    
    total_chunks INT UNSIGNED DEFAULT 1,
    uploaded_chunks INT UNSIGNED DEFAULT 0,
    
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    video_codec VARCHAR(50),
    video_bitrate INT UNSIGNED,
    resolution VARCHAR(20),
    frame_rate DECIMAL(5,2),
    
    error_message TEXT NULL,
    retry_count TINYINT UNSIGNED DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_interview_id (interview_id),
    INDEX idx_user_id (user_id),
    INDEX idx_video_type (video_type),
    INDEX idx_upload_status (upload_status),
    INDEX idx_interview_video_type (interview_id, video_type),
    
    FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_interview_video_type (interview_id, video_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const interviewVideoChunksTableQuery = `
CREATE TABLE IF NOT EXISTS interview_video_chunks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    video_id INT UNSIGNED NOT NULL,
    chunk_number INT UNSIGNED NOT NULL,
    chunk_size BIGINT UNSIGNED NOT NULL,
    
    temp_ftp_path VARCHAR(500),
    
    upload_status ENUM('pending', 'uploaded', 'failed') DEFAULT 'pending',
    uploaded_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_video_id (video_id),
    INDEX idx_chunk_number (chunk_number),
    INDEX idx_upload_status (upload_status),
    
    FOREIGN KEY (video_id) REFERENCES interview_videos(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_video_chunk (video_id, chunk_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createTable = async (pool, tableName, query) => {
  try {
    await pool.query(query);
    console.log(`Table ${tableName} created or already exists.`);
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error);
    throw error;
  }
};

const createAllTables = async (pool) => {
  try {
    await createTable(pool, "users", userTableQuery);
    await createTable(pool, "interviews", interviewTableQuery);
    await createTable(
      pool,
      "interview_questions",
      interviewQuestionsTableQuery,
    );

    await createTable(
      pool,
      "question_evaluations",
      questionEvaluationsTableQuery,
    );
    await createTable(
      pool,
      "interview_evaluations",
      interviewEvaluationsTableQuery,
    );
    await createTable(pool, "skill_evaluations", skillEvaluationsTableQuery);
    await createTable(pool, "interview_videos", interviewVideosTableQuery);
    await createTable(
      pool,
      "interview_video_chunks",
      interviewVideoChunksTableQuery,
    );

    console.log(" All tables created successfully.");
  } catch (error) {
    console.error("❌ Error creating tables:", error);
    throw error;
  }
};

module.exports = createAllTables;
