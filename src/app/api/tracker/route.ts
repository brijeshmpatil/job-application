import { NextRequest } from "next/server";
import {
  getAllJobs,
  createJob,
  updateJob,
  deleteJob,
  updateApplicationStatus,
  getStats,
} from "@/lib/db";
import type { ApplicationStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");

  if (action === "stats") {
    const stats = getStats();
    return Response.json(stats);
  }

  const jobs = getAllJobs();

  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const search = searchParams.get("search")?.toLowerCase();

  const filtered = jobs.filter((job) => {
    if (status && job.application?.status !== status) return false;
    if (type && job.type !== type) return false;
    if (
      search &&
      !job.company.toLowerCase().includes(search) &&
      !job.role.toLowerCase().includes(search)
    )
      return false;
    return true;
  });

  return Response.json({ jobs: filtered, total: filtered.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "create") {
    const job = createJob({
      company: body.company,
      role: body.role,
      type: body.type,
      location: body.location,
      salary_min: body.salary_min,
      salary_max: body.salary_max,
      apply_url: body.apply_url,
      description: body.description,
      source: body.source,
      skills: body.skills,
      hiring_status: body.hiring_status,
      notes: body.notes,
    });
    return Response.json({ job });
  }

  if (action === "update") {
    const job = updateJob(body.id, body.updates);
    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }
    return Response.json({ job });
  }

  if (action === "update_status") {
    const application = updateApplicationStatus(
      body.job_id,
      body.status as ApplicationStatus,
      body.notes
    );
    if (!application) {
      return Response.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }
    return Response.json({ application });
  }

  if (action === "delete") {
    const deleted = deleteJob(body.id);
    if (!deleted) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
