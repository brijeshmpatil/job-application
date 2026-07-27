import { NextRequest } from "next/server";
import { generateResumeChanges, validateTailoredResume } from "@/lib/ai";
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

  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY not set in .env.local" },
      { status: 500 }
    );
  }

  const resumeHtml = getResumeHtml();

  try {
    const result = await generateResumeChanges(
      resumeHtml,
      companyName || "Unknown",
      "Frontend Engineer",
      jobDescription
    );

    const isValid = validateTailoredResume(result.html);

    const changesForDisplay = result.changes.map((c) => ({
      section: c.section,
      before: c.find,
      after: c.replace,
      reason: c.reason,
    }));

    return Response.json({
      changes: changesForDisplay,
      html: isValid ? result.html : resumeHtml,
      valid: isValid,
      warning: isValid ? undefined : "AI output was invalid. Showing original resume.",
    });
  } catch (err) {
    console.error("Resume tailoring error:", err);
    return Response.json(
      { error: "Failed to tailor resume. Check API key and try again." },
      { status: 500 }
    );
  }
}
