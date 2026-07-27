import { NextRequest } from "next/server";
import {
  addToPipeline,
  getPipelineItems,
  getNextQueuedItem,
  getNextScrapedItem,
  updatePipelineItem,
  deletePipelineItem,
  getPipelineStats,
  createJob,
  updateApplicationStatus,
} from "@/lib/db";
import { scrapeCompanyJobs } from "@/lib/scraper";
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
    return "";
  }
}

// GET — fetch pipeline items or stats
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");

  if (action === "stats") {
    return Response.json(getPipelineStats());
  }

  const stage = searchParams.get("stage") || undefined;
  const items = getPipelineItems(stage);
  return Response.json({ items, total: items.length });
}

// POST — add to pipeline, process, approve, etc.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  // Add company to pipeline queue
  if (action === "add") {
    const item = addToPipeline({
      company: body.company,
      careers_url: body.careers_url,
      job_url: body.job_url,
      role: body.role,
    });
    return Response.json({ item });
  }

  // Add multiple companies at once
  if (action === "add_bulk") {
    const companies: string[] = body.companies || [];
    const items = companies.map((company: string) =>
      addToPipeline({ company })
    );
    return Response.json({ items, count: items.length });
  }

  // Process next queued item — scrape career page
  if (action === "process_next") {
    const item = getNextQueuedItem();
    if (!item) {
      return Response.json({ status: "empty", message: "No queued items" });
    }

    // Mark as scraping
    updatePipelineItem(item.id, { stage: "scraping" });

    try {
      const jobs = await scrapeCompanyJobs(
        item.company,
        item.careers_url || undefined
      );

      if (jobs.length === 0) {
        updatePipelineItem(item.id, {
          stage: "failed",
          error: `No frontend jobs found for ${item.company}`,
        });
        return Response.json({
          status: "no_jobs",
          company: item.company,
        });
      }

      // Use first matching job
      const job = jobs[0];
      updatePipelineItem(item.id, {
        stage: "scraped",
        role: job.role,
        location: job.location,
        description: job.description,
        job_url: job.applyUrl,
        source: job.source,
      });

      return Response.json({
        status: "scraped",
        company: item.company,
        role: job.role,
        source: job.source,
      });
    } catch (err) {
      updatePipelineItem(item.id, {
        stage: "failed",
        error: `Scraping error: ${err instanceof Error ? err.message : "Unknown"}`,
      });
      return Response.json({ status: "error", error: String(err) });
    }
  }

  // Tailor resume for next scraped item
  if (action === "tailor_next") {
    const item = getNextScrapedItem();
    if (!item) {
      return Response.json({
        status: "empty",
        message: "No scraped items to tailor",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY not set" },
        { status: 500 }
      );
    }

    updatePipelineItem(item.id, { stage: "tailoring" });

    try {
      const resumeHtml = getResumeHtml();
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      const prompt = `You are a resume tailoring expert. You MUST modify the EXACT HTML resume provided below. Do NOT create a new resume.

CRITICAL RULES:
1. The output MUST contain "Brijesh M Patil" — this is the candidate's real name
2. The output MUST contain "brijeshmpatil77@gmail.com" — real email
3. The output MUST contain "ShopTrade" — real current employer
4. NEVER invent fake companies, names, emails, degrees, or experience
5. ONLY modify text inside existing HTML tags — keep ALL HTML structure, CSS, classes EXACTLY as-is
6. Reorder skill tags to front-load JD matches
7. Rephrase bullet points to mirror JD language
8. Adjust summary paragraph to match JD priorities
9. If JD is vague, make MINIMAL changes
10. Output MUST be complete HTML starting with <!DOCTYPE html>

COMPANY: ${item.company}
ROLE: ${item.role || "Frontend Engineer"}

JOB DESCRIPTION:
${item.description || "No description available"}

BASE RESUME HTML (modify THIS document, do NOT create new):
${resumeHtml}

Respond with ONLY valid JSON (no markdown code fences):
{
  "changes": [
    {
      "section": "Summary|Experience|Skills|Projects",
      "before": "original text from the resume above",
      "after": "modified text",
      "reason": "why this change was made"
    }
  ],
  "html": "the COMPLETE modified HTML document starting with <!DOCTYPE html>"
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const cleanJson = responseText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      const parsed = JSON.parse(cleanJson);
      const html = parsed.html || "";

      // Validate — reject if AI hallucinated a new resume
      const isValid =
        html.includes("Brijesh") &&
        html.includes("brijeshmpatil77") &&
        html.includes("ShopTrade");

      if (!isValid) {
        // AI hallucinated — use original resume instead
        updatePipelineItem(item.id, {
          stage: "ready",
          tailored_html: resumeHtml,
          tailored_changes: JSON.stringify([{
            section: "Notice",
            before: "",
            after: "AI output was invalid (hallucinated). Using original resume. You can manually tailor on the Resume page.",
            reason: "Validation failed — AI created fake content instead of modifying your resume"
          }]),
        });
      } else {
        updatePipelineItem(item.id, {
          stage: "ready",
          tailored_html: html,
          tailored_changes: JSON.stringify(parsed.changes || []),
        });
      }

      return Response.json({
        status: "tailored",
        company: item.company,
        changes: parsed.changes?.length || 0,
        valid: isValid,
      });
    } catch (err) {
      updatePipelineItem(item.id, {
        stage: "failed",
        error: `Tailoring error: ${err instanceof Error ? err.message : "Unknown"}`,
      });
      return Response.json({ status: "error", error: String(err) });
    }
  }

  // Run full pipeline loop — process all queued and scraped items
  if (action === "run_loop") {
    const results: Array<{
      company: string;
      stage: string;
      status: string;
    }> = [];

    // Process up to 5 queued items
    for (let i = 0; i < 5; i++) {
      const item = getNextQueuedItem();
      if (!item) break;

      updatePipelineItem(item.id, { stage: "scraping" });

      try {
        const jobs = await scrapeCompanyJobs(
          item.company,
          item.careers_url || undefined
        );

        if (jobs.length === 0) {
          updatePipelineItem(item.id, {
            stage: "failed",
            error: "No frontend jobs found",
          });
          results.push({
            company: item.company,
            stage: "failed",
            status: "no_jobs",
          });
          continue;
        }

        const job = jobs[0];
        updatePipelineItem(item.id, {
          stage: "scraped",
          role: job.role,
          location: job.location,
          description: job.description,
          job_url: job.applyUrl,
          source: job.source,
        });
        results.push({
          company: item.company,
          stage: "scraped",
          status: "ok",
        });
      } catch {
        updatePipelineItem(item.id, {
          stage: "failed",
          error: "Scraping failed",
        });
        results.push({
          company: item.company,
          stage: "failed",
          status: "error",
        });
      }
    }

    // Tailor up to 3 scraped items
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      for (let i = 0; i < 3; i++) {
        const item = getNextScrapedItem();
        if (!item) break;

        updatePipelineItem(item.id, { stage: "tailoring" });

        try {
          const resumeHtml = getResumeHtml();
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
          });

          const prompt = `You are a resume tailoring expert. You MUST modify the EXACT HTML resume provided below. Do NOT create a new resume. Do NOT invent new content.

CRITICAL RULES:
1. The output HTML MUST contain the candidate's real name: "Brijesh M Patil"
2. The output HTML MUST contain the real email: "brijeshmpatil77@gmail.com"
3. The output HTML MUST contain the real company: "ShopTrade"
4. NEVER invent fake companies, fake names, fake emails, or fake experience
5. ONLY modify text content inside the existing HTML tags — keep all HTML structure, CSS, and classes EXACTLY as-is
6. You may reorder skill tags, rephrase bullet points, and adjust the summary paragraph
7. If the job description is too short or vague, make MINIMAL changes only
8. The output MUST be a valid complete HTML document starting with <!DOCTYPE html>

COMPANY: ${item.company}
ROLE: ${item.role || "Frontend Engineer"}
JOB DESCRIPTION: ${(item.description || "").slice(0, 3000)}

BASE RESUME HTML (modify THIS, do not create new):
${resumeHtml}

Respond with ONLY valid JSON (no code fences):
{"changes":[{"section":"Summary|Experience|Skills|Projects","before":"original text from resume","after":"modified text","reason":"why"}],"html":"the COMPLETE modified HTML document starting with <!DOCTYPE html>"}`;

          const result = await model.generateContent(prompt);
          const text = result.response.text();
          const clean = text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/, "")
            .trim();
          const parsed = JSON.parse(clean);
          const bulkHtml = parsed.html || "";

          const bulkValid =
            bulkHtml.includes("Brijesh") &&
            bulkHtml.includes("brijeshmpatil77") &&
            bulkHtml.includes("ShopTrade");

          if (!bulkValid) {
            updatePipelineItem(item.id, {
              stage: "ready",
              tailored_html: resumeHtml,
              tailored_changes: JSON.stringify([{
                section: "Notice",
                before: "",
                after: "AI output invalid. Using original resume.",
                reason: "Validation failed"
              }]),
            });
          } else {
            updatePipelineItem(item.id, {
              stage: "ready",
              tailored_html: bulkHtml,
              tailored_changes: JSON.stringify(parsed.changes || []),
            });
          }

          results.push({
            company: item.company,
            stage: "ready",
            status: "tailored",
          });
        } catch (tailorErr) {
          const errMsg = tailorErr instanceof Error ? tailorErr.message : String(tailorErr);
          const isRateLimit = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED");

          updatePipelineItem(item.id, {
            stage: isRateLimit ? "scraped" : "failed",
            error: isRateLimit ? "Rate limited — will retry next run" : `Tailoring failed: ${errMsg.slice(0, 100)}`,
          });
          results.push({
            company: item.company,
            stage: isRateLimit ? "scraped" : "failed",
            status: isRateLimit ? "rate_limited" : "tailor_error",
          });
          // Stop tailoring if rate limited
          if (isRateLimit) break;
        }
      }
    }

    return Response.json({ results, processed: results.length });
  }

  // Approve — move to tracker and open apply URL
  if (action === "approve") {
    const item = getPipelineItems().find((p) => p.id === body.id);
    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Create job in tracker
    const job = createJob({
      company: item.company,
      role: item.role || "Frontend Engineer",
      location: item.location || undefined,
      apply_url: item.job_url || undefined,
      description: item.description || undefined,
      source: item.source || undefined,
    });

    // Mark application as resume_tailored
    updateApplicationStatus(job.id, "resume_tailored");

    // Update pipeline item
    updatePipelineItem(item.id, { stage: "approved" });

    return Response.json({
      status: "approved",
      job,
      apply_url: item.job_url,
    });
  }

  // Skip item
  if (action === "skip") {
    updatePipelineItem(body.id, { stage: "skipped" });
    return Response.json({ status: "skipped" });
  }

  // Delete item
  if (action === "delete") {
    deletePipelineItem(body.id);
    return Response.json({ status: "deleted" });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
