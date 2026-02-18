const { Mistral } = require("@mistralai/mistralai");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const JSZip = require("jszip");

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// ─── Minimum viable text length ───────────────────────────────────────────────
// 50 chars is too aggressive — a one-page resume with short bullet points can
// easily collapse below this after whitespace normalization. Use 30 instead,
// and treat "too short" as a soft warning rather than a hard throw in most paths.
const MIN_TEXT_LENGTH = 30;

// ─── PDF text extraction ──────────────────────────────────────────────────────
// Tries Mistral OCR first. If the OCR returns empty/whitespace pages (common
// with image-only or poorly-encoded PDFs), falls back to fetching the raw PDF
// and sending it as a base64 document to the Mistral chat API for extraction.
async function extractPdfText(ftpUrl) {
  console.log("🔎 PDF detected → Trying Mistral OCR...");

  // ── Attempt 1: OCR endpoint ─────────────────────────────────────────────────
  try {
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

    if (ocrResponse.ok) {
      const ocrData = await ocrResponse.json();
      const ocrText =
        ocrData.pages?.map((p) => p.markdown || "").join("\n\n") || "";
      const cleaned = ocrText.replace(/\s+/g, " ").trim();

      if (cleaned.length >= MIN_TEXT_LENGTH) {
        console.log(`✅ OCR succeeded: ${cleaned.length} chars`);
        return cleaned;
      }
      console.warn(
        `⚠️ OCR returned too little text (${cleaned.length} chars) — trying base64 fallback`,
      );
    } else {
      console.warn(
        `⚠️ OCR endpoint returned ${ocrResponse.status} — trying base64 fallback`,
      );
    }
  } catch (ocrErr) {
    console.warn(
      "⚠️ OCR request failed:",
      ocrErr.message,
      "— trying base64 fallback",
    );
  }

  // ── Attempt 2: Download PDF → base64 → Mistral chat ───────────────────────
  // Works for image-based / scanned PDFs where OCR via URL fails.
  console.log("📥 Fetching PDF for base64 extraction fallback...");
  const pdfRes = await fetch(ftpUrl);
  if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  const base64Pdf = pdfBuffer.toString("base64");

  console.log(
    `📦 PDF size: ${Math.round(pdfBuffer.length / 1024)}KB — sending to Mistral chat`,
  );

  const chatRes = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            type: "text",
            text: "Extract all text from this document. Return only the extracted text, no commentary.",
          },
        ],
      },
    ],
  });

  const fallbackText = (chatRes.choices[0]?.message?.content || "")
    .replace(/\s+/g, " ")
    .trim();

  if (fallbackText.length < MIN_TEXT_LENGTH) {
    // Last resort: return whatever we got rather than throwing — the caller
    // will decide if it's good enough to generate a question from.
    console.warn(
      `⚠️ Base64 fallback also returned short text (${fallbackText.length} chars)`,
    );
  } else {
    console.log(`✅ Base64 fallback succeeded: ${fallbackText.length} chars`);
  }

  return fallbackText;
}

// ─── mistralResponse ──────────────────────────────────────────────────────────
async function mistralResponse({ ftpUrl, mimeType, originalFileName }) {
  if (!ftpUrl || !mimeType || !originalFileName) {
    throw new Error("ftpUrl, mimeType and originalFileName are required");
  }

  console.log("📝 Starting Mistral processing...");
  console.log("📄 File:", originalFileName);
  console.log("📦 Mime:", mimeType);
  console.log("🌐 FTP URL:", ftpUrl);

  let extractedText = "";

  if (mimeType === "application/pdf") {
    extractedText = await extractPdfText(ftpUrl);
  } else {
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

    extractedText = extractedText.replace(/\s+/g, " ").trim();
  }

  // FIX: Don't throw here — return a best-effort result so the caller can
  // decide whether to proceed with a generic question or surface an error.
  // The old hard throw of "Extracted text is too short" was crashing the
  // entire interview start flow for image-based PDFs.
  if (!extractedText || extractedText.length < MIN_TEXT_LENGTH) {
    console.warn(
      `⚠️ Text extraction yielded very little content (${extractedText?.length ?? 0} chars)`,
    );
    // Return a minimal valid object so callers don't crash on undefined
    return {
      summary: "",
      key_points: [],
      raw_text: "",
      extractionFailed: true,
    };
  }

  console.log("✅ Text extracted. Length:", extractedText.length);

  // ── Chunk + summarize ───────────────────────────────────────────────────────
  const maxChars = 12000;
  const chunks = [];
  for (let i = 0; i < extractedText.length; i += maxChars) {
    chunks.push(extractedText.slice(i, i + maxChars));
  }
  console.log("🧩 Total chunks:", chunks.length);

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

  // ── Final structured JSON ───────────────────────────────────────────────────
  const finalResponse = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "system",
        content: `Return STRICTLY valid JSON only. Do NOT use markdown. Do NOT use backticks.
Rules:
- key_points must include: technologies, tools, frameworks, projects, measurable outcomes (numbers, %)`,
      },
      {
        role: "user",
        content: `Return ONLY valid JSON:
{
  "summary": "",
  "key_points": [],
  "raw_text": ""
}

Content:
${summaries.join("\n\n")}`,
      },
    ],
  });

  const cleanJson = finalResponse.choices[0].message.content
    .replace(/```json|```/gi, "")
    .trim();

  const parsed = JSON.parse(cleanJson);

  // Enrich raw_text with key_points
  parsed.raw_text = `
=== KEY POINTS (IMPORTANT FOR INTERVIEW QUESTIONS) ===
${Array.isArray(parsed.key_points) ? parsed.key_points.map((p) => `- ${p}`).join("\n") : ""}

=== FULL RESUME TEXT ===
${extractedText}
`.trim();

  console.log("✅ mistralResponse complete");
  return parsed;
}

// ─── extractSkills (unchanged logic, same PDF fix applied) ───────────────────
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
  console.log("📄 File:", originalFileName, "| 📦 Mime:", mimeType);
  if (targetDomain)
    console.log(
      "🎯 Target Domain:",
      targetDomain,
      "| 📊 Threshold:",
      matchThreshold,
    );

  let extractedText = "";

  if (mimeType === "application/pdf") {
    extractedText = await extractPdfText(ftpUrl);
  } else {
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
    extractedText = extractedText.replace(/\s+/g, " ").trim();
  }

  if (!extractedText || extractedText.length < MIN_TEXT_LENGTH) {
    throw new Error("Extracted text is too short for skill extraction");
  }

  console.log("✅ Text extracted. Length:", extractedText.length);

  const systemPrompt = targetDomain
    ? `Extract all skills from the resume/document and score their relevance to the role: "${targetDomain}".
For each skill, assign a relevance score from 1-10.
Return STRICTLY valid JSON only. Do NOT use markdown. Do NOT use backticks.
Categorize into: technical_skills, soft_skills, certifications, languages.
Each skill: { skill, relevance_score }.`
    : `Extract all skills from the resume/document.
Return STRICTLY valid JSON only. Do NOT use markdown. Do NOT use backticks.
Categorize into: technical_skills, soft_skills, certifications, languages.`;

  const userPrompt = targetDomain
    ? `Extract skills, score relevance to "${targetDomain}" (1-10), return ONLY valid JSON:
{
  "technical_skills": [{ "skill": "name", "relevance_score": 8 }],
  "soft_skills": [{ "skill": "name", "relevance_score": 7 }],
  "certifications": [{ "skill": "name", "relevance_score": 9 }],
  "languages": [{ "skill": "name", "relevance_score": 5 }]
}
Document: ${extractedText}`
    : `Extract skills, return ONLY valid JSON:
{
  "technical_skills": [], "soft_skills": [], "certifications": [], "languages": [], "all_skills": []
}
Document: ${extractedText}`;

  const skillsResponse = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const cleanJson = skillsResponse.choices[0].message.content
    .replace(/```json|```/gi, "")
    .trim();
  let parsed = JSON.parse(cleanJson);

  if (targetDomain) {
    const filterSkills = (arr) =>
      (arr || [])
        .filter(
          (item) =>
            typeof item === "object" && item.relevance_score >= matchThreshold,
        )
        .sort((a, b) => b.relevance_score - a.relevance_score);

    const filtered = {
      technical_skills: filterSkills(parsed.technical_skills),
      soft_skills: filterSkills(parsed.soft_skills),
      certifications: filterSkills(parsed.certifications),
      languages: filterSkills(parsed.languages),
    };

    const totalExtracted = Object.values(parsed).flat().length;
    const all_relevant_skills = Object.values(filtered).flat();

    return {
      ...filtered,
      all_relevant_skills,
      metadata: {
        target_domain: targetDomain,
        match_threshold: matchThreshold,
        total_skills_extracted: totalExtracted,
        total_relevant_skills: all_relevant_skills.length,
        match_percentage:
          ((all_relevant_skills.length / totalExtracted) * 100).toFixed(1) +
          "%",
      },
    };
  }

  return parsed;
}

module.exports = { mistralResponse, extractSkills, mistral };
