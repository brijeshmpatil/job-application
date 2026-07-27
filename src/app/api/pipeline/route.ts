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
import { generateTailoredResume, buildTailorPrompt, validateTailoredResume } from "@/lib/ai";
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

function handleTailorResult(
  itemId: string,
  parsed: { changes?: Array<{ section: string; before: string; after: string; reason: string }>; html?: string },
  resumeHtml: string
): boolean {
  const html = parsed.html || "";
  const isValid = validateTailoredResume(html);

  if (!isValid) {
    updatePipelineItem(itemId, {
      stage: "ready",
      tailored_html: resumeHtml,
      tailored_changes: JSON.stringify([{
        section: "Notice",
        before: "",
        after: "AI output was invalid. Using original resume. Tailor manually on Resume page.",
        reason: "Validation failed — AI created fake content"
      }]),
    });
  } else {
    updatePipelineItem(itemId, {
      stage: "ready",
      tailored_html: html,
      tailored_changes: JSON.stringify(parsed.changes || []),
    });
  }

  return isValid;
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
        return Response.json({ status: "no_jobs", company: item.company });
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
      return Response.json({ status: "empty", message: "No scraped items to tailor" });
    }

    updatePipelineItem(item.id, { stage: "tailoring" });

    try {
      const resumeHtml = getResumeHtml();
      const prompt = buildTailorPrompt(
        resumeHtml,
        item.company,
        item.role || "Frontend Engineer",
        item.description || "No description available"
      );

      const parsed = await generateTailoredResume(prompt);
      const isValid = handleTailorResult(item.id, parsed, resumeHtml);

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

  // Run full pipeline loop
  if (action === "run_loop") {
    const results: Array<{ company: string; stage: string; status: string }> = [];

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
          updatePipelineItem(item.id, { stage: "failed", error: "No frontend jobs found" });
          results.push({ company: item.company, stage: "failed", status: "no_jobs" });
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
        results.push({ company: item.company, stage: "scraped", status: "ok" });
      } catch {
        updatePipelineItem(item.id, { stage: "failed", error: "Scraping failed" });
        results.push({ company: item.company, stage: "failed", status: "error" });
      }
    }

    // Tailor up to 3 scraped items
    for (let i = 0; i < 3; i++) {
      const item = getNextScrapedItem();
      if (!item) break;

      updatePipelineItem(item.id, { stage: "tailoring" });

      try {
        const resumeHtml = getResumeHtml();
        const prompt = buildTailorPrompt(
          resumeHtml,
          item.company,
          item.role || "Frontend Engineer",
          (item.description || "").slice(0, 3000)
        );

        const parsed = await generateTailoredResume(prompt);
        handleTailorResult(item.id, parsed, resumeHtml);
        results.push({ company: item.company, stage: "ready", status: "tailored" });
      } catch (tailorErr) {
        const errMsg = tailorErr instanceof Error ? tailorErr.message : String(tailorErr);
        const isRateLimit = errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("limit");

        updatePipelineItem(item.id, {
          stage: isRateLimit ? "scraped" : "failed",
          error: isRateLimit ? "Rate limited — retry next run" : `Tailoring failed: ${errMsg.slice(0, 100)}`,
        });
        results.push({
          company: item.company,
          stage: isRateLimit ? "scraped" : "failed",
          status: isRateLimit ? "rate_limited" : "tailor_error",
        });
        if (isRateLimit) break;
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

    const job = createJob({
      company: item.company,
      role: item.role || "Frontend Engineer",
      location: item.location || undefined,
      apply_url: item.job_url || undefined,
      description: item.description || undefined,
      source: item.source || undefined,
    });

    updateApplicationStatus(job.id, "resume_tailored");
    updatePipelineItem(item.id, { stage: "approved" });

    return Response.json({ status: "approved", job, apply_url: item.job_url });
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
