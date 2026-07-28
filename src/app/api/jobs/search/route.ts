import { NextRequest } from "next/server";
import { searchJobsFeed } from "@/lib/scraper";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query") || "frontend engineer";
  const location = searchParams.get("location") || "India";

  const jobs = await searchJobsFeed(query, location);

  const linkedinCount = jobs.filter((j) => j.source === "LinkedIn").length;
  const naukriCount = jobs.filter((j) => j.source === "Naukri").length;

  return Response.json({
    jobs,
    total: jobs.length,
    sources: {
      linkedin: linkedinCount,
      naukri: naukriCount,
    },
  });
}
