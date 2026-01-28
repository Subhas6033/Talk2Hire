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

  console.log("✅ Text extracted. Length:", extractedText.length);

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

module.exports = { mistralResponse };
