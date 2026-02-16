const { Mistral } = require("@mistralai/mistralai");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const JSZip = require("jszip");

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

async function mistralResponse({ ftpUrl, mimeType, originalFileName }) {
  if (!ftpUrl || !mimeType || !originalFileName) {
    throw new Error("ftpUrl, mimeType and originalFileName are required");
  }

  console.log("📝 Starting Mistral processing...");
  console.log("📄 File:", originalFileName);
  console.log("📦 Mime:", mimeType);
  console.log("🌐 FTP URL:", ftpUrl);

  let extractedText = "";

  // --- PDF → OCR ---
  if (mimeType === "application/pdf") {
    console.log("🔎 PDF detected → Using Mistral OCR");

    const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: { type: "document_url", document_url: ftpUrl },
        include_image_base64: false,
      }),
    });

    const ocrData = await ocrResponse.json();
    extractedText =
      ocrData.pages?.map((p) => p.markdown || "").join("\n\n") || "";
  }
  // --- Other file types ---
  else {
    const response = await fetch(ftpUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch file: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    if (mimeType === "text/plain") {
      extractedText = buffer.toString("utf-8");
    } else if (mimeType.includes("wordprocessingml.document")) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      workbook.SheetNames.forEach((sheet) => {
        extractedText += xlsx.utils.sheet_to_csv(workbook.Sheets[sheet]);
      });
    } else if (mimeType.includes("presentation")) {
      const zip = await JSZip.loadAsync(buffer);
      for (const file of Object.values(zip.files)) {
        if (file.name.includes("slide")) {
          extractedText += (await file.async("text")).replace(/<[^>]*>/g, " ");
        }
      }
    }
  }

  // --- Clean text ---
  extractedText = extractedText.replace(/\s+/g, " ").trim();
  if (!extractedText || extractedText.length < 50) {
    throw new Error("Extracted text is too short");
  }

  console.log(" Text extracted. Length:", extractedText.length);

  // --- Chunking for Mistral summarization ---
  const maxChars = 12000;
  const chunks = [];
  for (let i = 0; i < extractedText.length; i += maxChars) {
    chunks.push(extractedText.slice(i, i + maxChars));
  }
  console.log("🧩 Total chunks:", chunks.length);

  // --- Summarize each chunk using Mistral ---
  const summaries = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`🧠 Summarizing chunk ${i + 1}/${chunks.length}`);
    const summaryResponse = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content: "Summarize the following text clearly and concisely.",
        },
        { role: "user", content: chunks[i] },
      ],
    });
    summaries.push(summaryResponse.choices[0].message.content);
  }

  // --- Final summary JSON ---
  const finalResponse = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "system",
        content: `
Return STRICTLY valid JSON only.
Do NOT use markdown.
Do NOT use backticks.

Rules:
- key_points must include:
  - technologies
  - tools
  - frameworks
  - projects
  - measurable outcomes (numbers, %)
        `,
      },
      {
        role: "user",
        content: `
Return ONLY valid JSON:
{
  "summary": "",
  "key_points": [],
  "raw_text": ""
}

Content:
${summaries.join("\n\n")}
        `,
      },
    ],
  });

  const cleanJson = finalResponse.choices[0].message.content
    .replace(/```json|```/gi, "")
    .trim();

  const parsed = JSON.parse(cleanJson);

  // --- Enrich raw_text with key_points (NO OTHER CHANGES) ---
  const enrichedRawText = `
=== KEY POINTS (IMPORTANT FOR INTERVIEW QUESTIONS) ===
${
  Array.isArray(parsed.key_points)
    ? parsed.key_points.map((p) => `- ${p}`).join("\n")
    : ""
}

=== FULL RESUME TEXT ===
${extractedText}
  `.trim();

  parsed.raw_text = enrichedRawText;

  console.log(parsed);
  return parsed;
}

async function extractSkills({
  ftpUrl,
  mimeType,
  originalFileName,
  targetDomain = null,
  matchThreshold = 6,
}) {
  if (!ftpUrl || !mimeType || !originalFileName) {
    throw new Error("ftpUrl, mimeType and originalFileName are required");
  }

  console.log("🎯 Starting Skills Extraction...");
  console.log("📄 File:", originalFileName);
  console.log("📦 Mime:", mimeType);
  console.log("🌐 FTP URL:", ftpUrl);
  if (targetDomain) {
    console.log("🎯 Target Domain:", targetDomain);
    console.log("📊 Match Threshold:", matchThreshold);
  }

  let extractedText = "";

  // --- PDF → OCR ---
  if (mimeType === "application/pdf") {
    console.log("🔎 PDF detected → Using Mistral OCR");

    const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: { type: "document_url", document_url: ftpUrl },
        include_image_base64: false,
      }),
    });

    const ocrData = await ocrResponse.json();
    extractedText =
      ocrData.pages?.map((p) => p.markdown || "").join("\n\n") || "";
  }
  // --- Other file types ---
  else {
    const response = await fetch(ftpUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch file: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    if (mimeType === "text/plain") {
      extractedText = buffer.toString("utf-8");
    } else if (mimeType.includes("wordprocessingml.document")) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      workbook.SheetNames.forEach((sheet) => {
        extractedText += xlsx.utils.sheet_to_csv(workbook.Sheets[sheet]);
      });
    } else if (mimeType.includes("presentation")) {
      const zip = await JSZip.loadAsync(buffer);
      for (const file of Object.values(zip.files)) {
        if (file.name.includes("slide")) {
          extractedText += (await file.async("text")).replace(/<[^>]*>/g, " ");
        }
      }
    }
  }

  // --- Clean text ---
  extractedText = extractedText.replace(/\s+/g, " ").trim();
  if (!extractedText || extractedText.length < 50) {
    throw new Error("Extracted text is too short");
  }

  console.log(" Text extracted. Length:", extractedText.length);

  // --- Extract and filter skills using Mistral ---
  const systemPrompt = targetDomain
    ? `Extract all skills from the resume/document and score their relevance to the role: "${targetDomain}".

For each skill, assign a relevance score from 1-10:
- 10 = Absolutely critical for this role
- 7-9 = Highly relevant
- 4-6 = Somewhat relevant
- 1-3 = Minimally relevant

Return STRICTLY valid JSON only. Do NOT use markdown. Do NOT use backticks.

Categorize skills into:
- technical_skills (programming languages, frameworks, tools, technologies)
- soft_skills (communication, leadership, teamwork, etc.)
- certifications (any certifications mentioned)
- languages (spoken/written languages)

Each skill should include: skill name and relevance_score (1-10).`
    : `Extract all skills from the resume/document.
Return STRICTLY valid JSON only.
Do NOT use markdown.
Do NOT use backticks.

Categorize skills into:
- technical_skills (programming languages, frameworks, tools, technologies)
- soft_skills (communication, leadership, teamwork, etc.)
- certifications (any certifications mentioned)
- languages (spoken/written languages)`;

  const userPrompt = targetDomain
    ? `Extract skills from this document, score each skill's relevance to the "${targetDomain}" role (1-10), and return ONLY valid JSON:

{
  "technical_skills": [
    { "skill": "skill name", "relevance_score": 8 }
  ],
  "soft_skills": [
    { "skill": "skill name", "relevance_score": 7 }
  ],
  "certifications": [
    { "skill": "certification name", "relevance_score": 9 }
  ],
  "languages": [
    { "skill": "language name", "relevance_score": 5 }
  ]
}

Document text:
${extractedText}`
    : `Extract skills from this document and return ONLY valid JSON:
{
  "technical_skills": [],
  "soft_skills": [],
  "certifications": [],
  "languages": [],
  "all_skills": []
}

Document text:
${extractedText}`;

  const skillsResponse = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const cleanJson = skillsResponse.choices[0].message.content
    .replace(/```json|```/gi, "")
    .trim();

  let parsed = JSON.parse(cleanJson);

  // --- Filter by domain if specified ---
  if (targetDomain) {
    console.log(`🔍 Filtering skills for domain: ${targetDomain}`);
    console.log(`📊 Using threshold: ${matchThreshold}/10`);

    const filterSkills = (skillsArray) => {
      if (!Array.isArray(skillsArray)) return [];

      return skillsArray
        .filter((item) => {
          const score = typeof item === "object" ? item.relevance_score : null;
          return score !== null && score >= matchThreshold;
        })
        .sort((a, b) => b.relevance_score - a.relevance_score);
    };

    const filtered = {
      technical_skills: filterSkills(parsed.technical_skills || []),
      soft_skills: filterSkills(parsed.soft_skills || []),
      certifications: filterSkills(parsed.certifications || []),
      languages: filterSkills(parsed.languages || []),
    };

    // Create summary
    const totalExtracted =
      (parsed.technical_skills?.length || 0) +
      (parsed.soft_skills?.length || 0) +
      (parsed.certifications?.length || 0) +
      (parsed.languages?.length || 0);

    const totalRelevant =
      filtered.technical_skills.length +
      filtered.soft_skills.length +
      filtered.certifications.length +
      filtered.languages.length;

    // Flatten all relevant skills
    const all_relevant_skills = [
      ...filtered.technical_skills,
      ...filtered.soft_skills,
      ...filtered.certifications,
      ...filtered.languages,
    ];

    const result = {
      ...filtered,
      all_relevant_skills,
      metadata: {
        target_domain: targetDomain,
        match_threshold: matchThreshold,
        total_skills_extracted: totalExtracted,
        total_relevant_skills: totalRelevant,
        match_percentage:
          ((totalRelevant / totalExtracted) * 100).toFixed(1) + "%",
      },
    };

    console.log(" Skills filtered successfully");
    console.log(`📊 Extracted: ${totalExtracted} skills`);
    console.log(
      ` Relevant: ${totalRelevant} skills (${result.metadata.match_percentage} match)`,
    );
    console.log("🏆 Top Skills:");
    all_relevant_skills.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.skill} (${s.relevance_score}/10)`);
    });

    return result;
  } else {
    // No domain filtering - return all skills
    console.log(" Skills extracted successfully (no filtering)");
    console.log(parsed);
    return parsed;
  }
}

module.exports = { mistralResponse, extractSkills, mistral };
