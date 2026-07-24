export interface Job {
  id: string;
  company: string;
  role: string;
  type: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  apply_url: string | null;
  description: string | null;
  source: string | null;
  skills: string[];
  hiring_status: string | null;
  notes: string | null;
  created_at: string;
}

export interface Application {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_date: string | null;
  platform: string | null;
  resume_variant_id: string | null;
  notes: string | null;
  updated_at: string;
}

export interface ResumeVariant {
  id: string;
  job_id: string | null;
  changes: ResumeChange[];
  html_content: string;
  pdf_path: string | null;
  status: "draft" | "approved" | "exported";
  created_at: string;
}

export interface ResumeChange {
  section: string;
  type: "reorder" | "rewrite" | "add" | "remove";
  before: string;
  after: string;
  reason: string;
}

export type ApplicationStatus =
  | "not_applied"
  | "resume_tailored"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export interface JobWithApplication extends Job {
  application: Application | null;
}

export interface JobSearchParams {
  query: string;
  location?: string;
  minSalary?: number;
  maxResults?: number;
}

export interface JobSearchResult {
  source: string;
  sourceId: string;
  title: string;
  company: string;
  location: string;
  salaryRange: string | null;
  description: string;
  applyUrl: string;
  postedDate: string | null;
  skills: string[];
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  not_applied: "Not Applied",
  resume_tailored: "Resume Tailored",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export type PipelineStage =
  | "queued"
  | "scraping"
  | "scraped"
  | "tailoring"
  | "ready"
  | "approved"
  | "applying"
  | "applied"
  | "failed"
  | "skipped";

export interface PipelineItem {
  id: string;
  company: string;
  careers_url: string | null;
  job_url: string | null;
  role: string | null;
  location: string | null;
  description: string | null;
  tailored_html: string | null;
  tailored_changes: string | null;
  stage: PipelineStage;
  error: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  queued: "Queued",
  scraping: "Scraping...",
  scraped: "JD Found",
  tailoring: "Tailoring...",
  ready: "Ready to Review",
  approved: "Approved",
  applying: "Applying...",
  applied: "Applied",
  failed: "Failed",
  skipped: "Skipped",
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  queued: "bg-gray-100 text-gray-600",
  scraping: "bg-yellow-100 text-yellow-700 animate-pulse",
  scraped: "bg-blue-100 text-blue-700",
  tailoring: "bg-purple-100 text-purple-700 animate-pulse",
  ready: "bg-green-100 text-green-700",
  approved: "bg-indigo-100 text-indigo-700",
  applying: "bg-yellow-100 text-yellow-700 animate-pulse",
  applied: "bg-green-200 text-green-800",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-200 text-gray-500",
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  not_applied: "bg-gray-100 text-gray-700",
  resume_tailored: "bg-blue-100 text-blue-700",
  applied: "bg-yellow-100 text-yellow-700",
  screening: "bg-purple-100 text-purple-700",
  interview: "bg-indigo-100 text-indigo-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-200 text-gray-500",
};
