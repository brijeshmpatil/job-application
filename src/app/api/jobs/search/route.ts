import { NextRequest } from "next/server";

interface AdzunaJob {
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  description: string;
  created: string;
}

async function searchAdzuna(
  query: string,
  location: string
): Promise<
  Array<{
    title: string;
    company: string;
    location: string;
    salary: string;
    url: string;
    description: string;
  }>
> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) return [];

  const country = location.toLowerCase().includes("india") ? "in" : "gb";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: query,
    "content-type": "application/json",
  });

  if (
    location &&
    !location.toLowerCase().includes("india") &&
    !location.toLowerCase().includes("remote")
  ) {
    params.set("where", location);
  }

  try {
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || []).map((job: AdzunaJob) => ({
      title: job.title,
      company: job.company?.display_name || "Unknown",
      location: job.location?.display_name || location,
      salary:
        job.salary_min && job.salary_max
          ? `${Math.round(job.salary_min / 100000)}-${Math.round(job.salary_max / 100000)} LPA`
          : "",
      url: job.redirect_url,
      description: job.description?.slice(0, 300) || "",
      source: "Adzuna",
    }));
  } catch {
    return [];
  }
}

async function searchFindWork(
  query: string
): Promise<
  Array<{
    title: string;
    company: string;
    location: string;
    salary: string;
    url: string;
    description: string;
  }>
> {
  const apiKey = process.env.FINDWORK_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      search: query,
      sort_by: "relevance",
    });

    const res = await fetch(`https://findwork.dev/api/jobs/?${params}`, {
      headers: { Authorization: `Token ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || []).map(
      (job: {
        role: string;
        company_name: string;
        location: string;
        url: string;
        text: string;
      }) => ({
        title: job.role,
        company: job.company_name || "Unknown",
        location: job.location || "Remote",
        salary: "",
        url: job.url,
        description: (job.text || "").slice(0, 300),
        source: "FindWork",
      })
    );
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query") || "frontend engineer";
  const location = searchParams.get("location") || "India";

  const [adzunaResults, findworkResults] = await Promise.all([
    searchAdzuna(query, location),
    searchFindWork(query),
  ]);

  const allJobs = [...adzunaResults, ...findworkResults];

  return Response.json({
    jobs: allJobs,
    total: allJobs.length,
    sources: {
      adzuna: adzunaResults.length,
      findwork: findworkResults.length,
    },
  });
}
