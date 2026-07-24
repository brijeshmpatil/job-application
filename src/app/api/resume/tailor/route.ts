import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import path from "path";

const RESUME_PATH = path.join(
  process.env.HOME || "",
  "Desktop/RaveR/Brijesh_M_Patil_Resume.html"
);

function getResumeHtml(): string {
  try {
    return readFileSync(RESUME_PATH, "utf-8");
  } catch {
    throw new Error(`Resume not found at ${RESUME_PATH}`);
  }
}

export async function POST(request: NextRequest) {
  const { jobDescription, companyName } = await request.json();

  if (!jobDescription) {
    return Response.json(
      { error: "Job description is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY not set in .env.local" },
      { status: 500 }
    );
  }

  const resumeHtml = getResumeHtml();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a resume tailoring expert. Given a base resume (HTML) and a job description, produce a tailored version.

RULES:
1. NEVER fabricate skills, experience, or projects the candidate doesn't have
2. ONLY reorder, rephrase, or emphasize existing content to better match the JD
3. Adjust the summary paragraph to mirror the JD's language
4. Reorder skill tags to front-load matches (e.g., if JD emphasizes "WCAG", move accessibility skills higher)
5. Adjust bullet point emphasis — if the JD is for fintech, emphasize B2B/B2C and data-handling experience
6. Keep the HTML structure and CSS exactly the same — only change text content
7. Keep all existing information — don't remove anything unless replacing with better wording

COMPANY: ${companyName || "Unknown"}

JOB DESCRIPTION:
${jobDescription}

BASE RESUME HTML:
${resumeHtml}

Respond with ONLY a valid JSON object (no markdown code fences, no extra text):
{
  "changes": [
    {
      "section": "Summary|Experience|Skills|Projects",
      "before": "original text",
      "after": "modified text",
      "reason": "why this change was made"
    }
  ],
  "html": "the complete modified HTML resume"
}

Only include actual changes in the changes array — if a section didn't change, don't include it.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response — handle potential markdown fences
    const cleanJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleanJson);

    return Response.json({
      changes: parsed.changes || [],
      html: parsed.html || resumeHtml,
    });
  } catch (err) {
    console.error("Resume tailoring error:", err);
    return Response.json(
      { error: "Failed to tailor resume. Check API key and try again." },
      { status: 500 }
    );
  }
}
