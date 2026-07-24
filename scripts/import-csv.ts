import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import path from "path";
import { mkdirSync } from "fs";

// Ensure data directory exists
mkdirSync(path.join(process.cwd(), "data"), { recursive: true });

// Dynamic import for ESM compatibility
async function main() {
  const { bulkCreateJobs } = await import("../src/lib/db");

  const csvPath =
    process.argv[2] ||
    path.join(
      process.env.HOME || "",
      "Desktop/RaveR/Job_Application_Tracker.csv"
    );

  console.log(`Reading CSV from: ${csvPath}`);
  const csvContent = readFileSync(csvPath, "utf-8");

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  console.log(`Found ${records.length} records`);

  const jobs = records.map((record) => {
    const salaryRange = record["Salary Range (LPA)"] || "";
    const [minStr, maxStr] = salaryRange.split("-").map((s) => s.trim());
    const salaryMin = minStr ? parseInt(minStr, 10) : undefined;
    const salaryMax = maxStr ? parseInt(maxStr, 10) : undefined;

    return {
      company: record["Company"] || "",
      role: record["Role"] || "",
      type: record["Type"] || undefined,
      location: record["Location"] || undefined,
      salary_min: isNaN(salaryMin as number) ? undefined : salaryMin,
      salary_max: isNaN(salaryMax as number) ? undefined : salaryMax,
      apply_url: record["Apply Link"] || undefined,
      hiring_status: record["Hiring Status (Jul 2026)"] || undefined,
      notes: record["Notes"] || undefined,
    };
  });

  const validJobs = jobs.filter((j) => j.company && j.role);
  const count = bulkCreateJobs(validJobs);
  console.log(`Imported ${count} jobs into database`);
}

main().catch(console.error);
