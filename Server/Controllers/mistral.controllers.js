const { Mistral } = require("@mistralai/mistralai");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const JSZip = require("jszip");

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

/**
 * Express Controller
 */
const readFileFromUrlWithMistral = async (req, res, next) => {
  try {
    const { ftpUrl, mimeType, originalFileName } = req.body;

    if (!ftpUrl || !mimeType || !originalFileName) {
      return res.status(400).json({
        message: "ftpUrl, mimeType and originalFileName are required",
      });
    }

    console.log("📝 Starting Mistral processing...");
    console.log("📄 File:", originalFileName);
    console.log("📦 Mime:", mimeType);
    console.log("🌐 FTP URL:", ftpUrl);

    let extractedText = "";

    // Extract Text
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
          document: {
            type: "document_url",
            document_url: ftpUrl,
          },
          include_image_base64: false,
        }),
      });

      const ocrData = await ocrResponse.json();

      extractedText =
        ocrData.pages
          ?.map((p, idx) => `--- Page ${idx + 1} ---\n${p.markdown || ""}`)
          .join("\n\n") || "";
    } else {
      console.log("📥 Fetching file buffer...");
      const response = await fetch(ftpUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (mimeType === "text/plain") {
        extractedText = buffer.toString("utf-8");
      } else if (mimeType.includes("wordprocessingml.document")) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else if (
        mimeType.includes("spreadsheet") ||
        mimeType.includes("excel")
      ) {
        const workbook = xlsx.read(buffer, { type: "buffer" });
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          extractedText += xlsx.utils.sheet_to_csv(sheet);
        });
      } else if (mimeType.includes("presentation")) {
        const zip = await JSZip.loadAsync(buffer);
        for (const [filename, file] of Object.entries(zip.files)) {
          if (
            filename.startsWith("ppt/slides/slide") &&
            filename.endsWith(".xml")
          ) {
            const slideXml = await file.async("text");
            extractedText += slideXml.replace(/<[^>]*>/g, " ");
          }
        }
      }
    }

    // Clean the text
    extractedText = extractedText
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!extractedText || extractedText.length < 50) {
      throw new Error("Extracted text is empty or too short");
    }

    console.log("✅ Text extracted. Length:", extractedText.length);

    // Create chunks for large number of text
    const maxChars = 12000;
    const chunks = [];
    for (let i = 0; i < extractedText.length; i += maxChars) {
      chunks.push(extractedText.slice(i, i + maxChars));
    }

    console.log("🧩 Total chunks:", chunks.length);

    // Push the chunks sumarizers
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
          {
            role: "user",
            content: chunks[i],
          },
        ],
      });

      summaries.push(summaryResponse.choices[0].message.content);
    }

    // Generate the final response in JSON
    const finalResponse = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content:
            "Return STRICTLY valid JSON only. No markdown. No backticks.",
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
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    parsed.raw_text = extractedText;

    res.status(200).json(parsed);
  } catch (error) {
    console.error("❌ Mistral Controller Error:", error);
    next(error);
  }
};

module.exports = { readFileFromUrlWithMistral };
