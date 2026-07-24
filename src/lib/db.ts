import Database from "better-sqlite3";
import path from "path";
import { v4 as uuid } from "uuid";
import type {
  Job,
  Application,
  ApplicationStatus,
  JobWithApplication,
} from "./types";

const DB_PATH = path.join(process.cwd(), "data", "jobs.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      type TEXT,
      location TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      apply_url TEXT,
      description TEXT,
      source TEXT,
      skills TEXT DEFAULT '[]',
      hiring_status TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'not_applied',
      applied_date TEXT,
      platform TEXT,
      resume_variant_id TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resume_variants (
      id TEXT PRIMARY KEY,
      job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      changes TEXT DEFAULT '[]',
      html_content TEXT NOT NULL,
      pdf_path TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_resume_variants_job_id ON resume_variants(job_id);
  `);
}

function parseJob(row: Record<string, unknown>): Job {
  return {
    ...row,
    skills: JSON.parse((row.skills as string) || "[]"),
  } as Job;
}

// --- Jobs ---

export function getAllJobs(): JobWithApplication[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT j.*, a.id as app_id, a.status as app_status, a.applied_date,
           a.platform, a.resume_variant_id, a.notes as app_notes, a.updated_at as app_updated_at
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    ORDER BY j.created_at DESC
  `
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => {
    const job = parseJob(row);
    const application: Application | null = row.app_id
      ? {
          id: row.app_id as string,
          job_id: row.id as string,
          status: (row.app_status as ApplicationStatus) || "not_applied",
          applied_date: (row.applied_date as string) || null,
          platform: (row.platform as string) || null,
          resume_variant_id: (row.resume_variant_id as string) || null,
          notes: (row.app_notes as string) || null,
          updated_at: (row.app_updated_at as string) || "",
        }
      : null;

    return { ...job, application };
  });
}

export function getJobById(id: string): JobWithApplication | null {
  const db = getDb();
  const row = db
    .prepare(
      `
    SELECT j.*, a.id as app_id, a.status as app_status, a.applied_date,
           a.platform, a.resume_variant_id, a.notes as app_notes, a.updated_at as app_updated_at
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    WHERE j.id = ?
  `
    )
    .get(id) as Record<string, unknown> | undefined;

  if (!row) return null;

  const job = parseJob(row);
  const application: Application | null = row.app_id
    ? {
        id: row.app_id as string,
        job_id: row.id as string,
        status: (row.app_status as ApplicationStatus) || "not_applied",
        applied_date: (row.applied_date as string) || null,
        platform: (row.platform as string) || null,
        resume_variant_id: (row.resume_variant_id as string) || null,
        notes: (row.app_notes as string) || null,
        updated_at: (row.app_updated_at as string) || "",
      }
    : null;

  return { ...job, application };
}

export function createJob(job: {
  company: string;
  role: string;
  type?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  apply_url?: string;
  description?: string;
  source?: string;
  skills?: string[];
  hiring_status?: string;
  notes?: string;
}): Job {
  const db = getDb();
  const id = uuid();

  db.prepare(
    `
    INSERT INTO jobs (id, company, role, type, location, salary_min, salary_max,
                      apply_url, description, source, skills, hiring_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    job.company,
    job.role,
    job.type || null,
    job.location || null,
    job.salary_min || null,
    job.salary_max || null,
    job.apply_url || null,
    job.description || null,
    job.source || null,
    JSON.stringify(job.skills || []),
    job.hiring_status || null,
    job.notes || null
  );

  const appId = uuid();
  db.prepare(
    `INSERT INTO applications (id, job_id, status) VALUES (?, ?, 'not_applied')`
  ).run(appId, id);

  return getJobById(id) as Job;
}

export function updateJob(
  id: string,
  updates: Partial<{
    company: string;
    role: string;
    type: string;
    location: string;
    salary_min: number;
    salary_max: number;
    apply_url: string;
    description: string;
    source: string;
    skills: string[];
    hiring_status: string;
    notes: string;
  }>
): Job | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === "skills" ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) return getJobById(id);

  values.push(id);
  db.prepare(`UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values
  );

  return getJobById(id);
}

export function deleteJob(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  return result.changes > 0;
}

// --- Applications ---

export function updateApplicationStatus(
  jobId: string,
  status: ApplicationStatus,
  notes?: string
): Application | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM applications WHERE job_id = ?")
    .get(jobId) as { id: string } | undefined;

  if (!existing) return null;

  const appliedDate = status === "applied" ? new Date().toISOString() : null;

  db.prepare(
    `
    UPDATE applications
    SET status = ?, notes = COALESCE(?, notes), applied_date = COALESCE(?, applied_date),
        updated_at = datetime('now')
    WHERE job_id = ?
  `
  ).run(status, notes || null, appliedDate, jobId);

  return db
    .prepare("SELECT * FROM applications WHERE job_id = ?")
    .get(jobId) as Application;
}

// --- Stats ---

export function getStats(): {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
} {
  const db = getDb();

  const total = (
    db.prepare("SELECT COUNT(*) as count FROM jobs").get() as { count: number }
  ).count;

  const statusRows = db
    .prepare(
      `
    SELECT a.status, COUNT(*) as count
    FROM applications a
    GROUP BY a.status
  `
    )
    .all() as { status: string; count: number }[];

  const typeRows = db
    .prepare(
      `
    SELECT COALESCE(type, 'Unknown') as type, COUNT(*) as count
    FROM jobs
    GROUP BY type
  `
    )
    .all() as { type: string; count: number }[];

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[row.status] = row.count;
  }

  const byType: Record<string, number> = {};
  for (const row of typeRows) {
    byType[row.type] = row.count;
  }

  return { total, byStatus, byType };
}

// --- Bulk Import ---

export function bulkCreateJobs(
  jobs: Array<{
    company: string;
    role: string;
    type?: string;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    apply_url?: string;
    hiring_status?: string;
    notes?: string;
  }>
): number {
  const db = getDb();

  const insertJob = db.prepare(`
    INSERT INTO jobs (id, company, role, type, location, salary_min, salary_max,
                      apply_url, hiring_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertApp = db.prepare(
    `INSERT INTO applications (id, job_id, status) VALUES (?, ?, 'not_applied')`
  );

  const insertMany = db.transaction(
    (
      items: Array<{
        company: string;
        role: string;
        type?: string;
        location?: string;
        salary_min?: number;
        salary_max?: number;
        apply_url?: string;
        hiring_status?: string;
        notes?: string;
      }>
    ) => {
      let count = 0;
      for (const item of items) {
        const jobId = uuid();
        const appId = uuid();
        insertJob.run(
          jobId,
          item.company,
          item.role,
          item.type || null,
          item.location || null,
          item.salary_min || null,
          item.salary_max || null,
          item.apply_url || null,
          item.hiring_status || null,
          item.notes || null
        );
        insertApp.run(appId, jobId);
        count++;
      }
      return count;
    }
  );

  return insertMany(jobs);
}
