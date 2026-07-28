/**
 * Job scraper — searches LinkedIn and Naukri public listings.
 * No login required. No auto-apply. Just fetches public job data.
 */

interface ScrapedJob {
  role: string;
  location: string;
  description: string;
  applyUrl: string;
  source: "linkedin" | "naukri" | "career_page";
}

// Max experience in years — filters out senior/staff roles requiring 8+ years
const MAX_EXPERIENCE_YEARS = 5;

// Keywords that indicate the role needs too much experience
const SENIOR_BLOCKLIST = [
  "staff engineer",
  "principal engineer",
  "distinguished engineer",
  "engineering manager",
  "director of engineering",
  "vp engineering",
  "head of engineering",
  "architect",
  "lead architect",
];

/**
 * Extract years of experience required from job title + description.
 * Returns null if can't determine.
 */
function extractExperienceYears(title: string, description: string): number | null {
  const text = `${title} ${description}`.toLowerCase();

  // Check blocklist first
  for (const blocked of SENIOR_BLOCKLIST) {
    if (text.includes(blocked)) return 99;
  }

  // Match patterns like "8+ years", "10-12 years", "8 to 12 years", "minimum 8 years"
  const patterns = [
    /(\d{1,2})\s*\+\s*(?:years|yrs|yr)/i,
    /(\d{1,2})\s*-\s*(\d{1,2})\s*(?:years|yrs|yr)/i,
    /(\d{1,2})\s*to\s*(\d{1,2})\s*(?:years|yrs|yr)/i,
    /(?:minimum|min|at least)\s*(\d{1,2})\s*(?:years|yrs|yr)/i,
    /(?:experience|exp)[:\s]*(\d{1,2})\s*(?:years|yrs|yr)/i,
    /(\d{1,2})\s*(?:years|yrs|yr)\s*(?:of\s*)?(?:experience|exp)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // For ranges like "8-12", use the minimum
      const minYears = parseInt(match[1], 10);
      return minYears;
    }
  }

  // Infer from title keywords
  if (text.includes("senior") || text.includes("sr.") || text.includes("sr ")) return 5;
  if (text.includes("lead")) return 5;
  if (text.includes("junior") || text.includes("jr")) return 1;
  if (text.includes("intern")) return 0;

  return null;
}

/**
 * Check if job is within experience range for the candidate (0-5 years).
 */
function isExperienceMatch(title: string, description: string): boolean {
  const years = extractExperienceYears(title, description);
  if (years === null) return true; // Can't determine, include it
  return years <= MAX_EXPERIENCE_YEARS;
}

const FRONTEND_KEYWORDS = [
  "frontend",
  "front-end",
  "front end",
  "react",
  "ui engineer",
  "ui developer",
  "web developer",
  "javascript engineer",
  "typescript",
];

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    return await res.text();
  } catch {
    return null;
  }
}

// --- LinkedIn Public Job Search ---

interface LinkedInJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
}

async function searchLinkedIn(
  query: string,
  location: string
): Promise<LinkedInJob[]> {
  // LinkedIn public job search (no login needed)
  const encodedQuery = encodeURIComponent(query);
  const encodedLocation = encodeURIComponent(location);
  const url = `https://www.linkedin.com/jobs/search?keywords=${encodedQuery}&location=${encodedLocation}&f_TPR=r604800&position=1&pageNum=0`;

  const html = await fetchPage(url);
  if (!html) return [];

  const jobs: LinkedInJob[] = [];

  // Extract job cards from LinkedIn public page
  // LinkedIn public pages have structured data in <script type="application/ld+json">
  const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let jsonMatch;

  while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      if (data["@type"] === "JobPosting") {
        jobs.push({
          title: data.title || "",
          company: data.hiringOrganization?.name || "",
          location: data.jobLocation?.address?.addressLocality || location,
          url: data.url || "",
          description: (data.description || "").replace(/<[^>]*>/g, "").slice(0, 500),
        });
      }
      // Handle array of job postings
      if (Array.isArray(data.itemListElement)) {
        for (const item of data.itemListElement) {
          const job = item.item || item;
          if (job["@type"] === "JobPosting" || job.title) {
            jobs.push({
              title: job.title || "",
              company: job.hiringOrganization?.name || "",
              location: job.jobLocation?.address?.addressLocality || location,
              url: job.url || "",
              description: (job.description || "").replace(/<[^>]*>/g, "").slice(0, 500),
            });
          }
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  // Fallback: extract from HTML job cards
  if (jobs.length === 0) {
    const cardRegex = /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*sr-only[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    const companyRegex = /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/gi;
    const locationRegex = /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;

    const titles: Array<{ url: string; title: string }> = [];
    let cardMatch;
    while ((cardMatch = cardRegex.exec(html)) !== null) {
      titles.push({
        url: cardMatch[1].trim(),
        title: cardMatch[2].replace(/<[^>]*>/g, "").trim(),
      });
    }

    const companies: string[] = [];
    let compMatch;
    while ((compMatch = companyRegex.exec(html)) !== null) {
      companies.push(compMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    const locations: string[] = [];
    let locMatch;
    while ((locMatch = locationRegex.exec(html)) !== null) {
      locations.push(locMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    for (let i = 0; i < Math.min(titles.length, 20); i++) {
      jobs.push({
        title: titles[i].title,
        company: companies[i] || "Unknown",
        location: locations[i] || location,
        url: titles[i].url,
        description: "",
      });
    }
  }

  // Filter by experience
  const filtered = jobs.filter((j) => isExperienceMatch(j.title, j.description));
  return filtered.slice(0, 20);
}

// --- Naukri Public Job Search ---

interface NaukriJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary: string;
}

async function searchNaukri(
  query: string,
  location: string
): Promise<NaukriJob[]> {
  // Naukri public job search
  const encodedQuery = query.replace(/\s+/g, "-");
  const encodedLocation = location.toLowerCase().replace(/\s+/g, "-");
  const url = `https://www.naukri.com/${encodedQuery}-jobs-in-${encodedLocation}`;

  const html = await fetchPage(url);
  if (!html) return [];

  const jobs: NaukriJob[] = [];

  // Try JSON-LD first
  const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let jsonMatch;

  while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      if (data["@type"] === "JobPosting") {
        jobs.push({
          title: data.title || "",
          company: data.hiringOrganization?.name || "",
          location: data.jobLocation?.address?.addressLocality || location,
          url: data.url || "",
          description: (data.description || "").replace(/<[^>]*>/g, "").slice(0, 500),
          salary: data.baseSalary?.value?.value ? `${data.baseSalary.value.value}` : "",
        });
      }
      if (Array.isArray(data.itemListElement)) {
        for (const item of data.itemListElement.slice(0, 20)) {
          const job = item.item || item;
          if (job.title) {
            jobs.push({
              title: job.title || "",
              company: job.hiringOrganization?.name || "",
              location: job.jobLocation?.address?.addressLocality || location,
              url: job.url || "",
              description: (job.description || "").replace(/<[^>]*>/g, "").slice(0, 500),
              salary: "",
            });
          }
        }
      }
    } catch {
      // Skip
    }
  }

  // Fallback: extract from Naukri HTML structure
  if (jobs.length === 0) {
    const titleRegex = /<a[^>]*class="[^"]*title[^"]*"[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>/gi;
    let titleMatch;

    while ((titleMatch = titleRegex.exec(html)) !== null) {
      jobs.push({
        title: titleMatch[2].trim(),
        company: "",
        location: location,
        url: titleMatch[1].trim(),
        description: "",
        salary: "",
      });
    }
  }

  const filtered = jobs.filter((j) => isExperienceMatch(j.title, j.description));
  return filtered.slice(0, 20);
}

// --- Company-specific search ---

export async function scrapeCompanyJobs(
  company: string,
  careersUrl?: string
): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

  // Step 1: Search LinkedIn for company + frontend roles
  const linkedInJobs = await searchLinkedIn(
    `frontend engineer ${company}`,
    "India"
  );

  const companyLower = company.toLowerCase();
  const matchedLinkedIn = linkedInJobs.filter((j) =>
    j.company.toLowerCase().includes(companyLower.slice(0, 4)) ||
    j.title.toLowerCase().includes("frontend") ||
    j.title.toLowerCase().includes("react")
  );

  for (const job of matchedLinkedIn.slice(0, 3)) {
    jobs.push({
      role: job.title,
      location: job.location,
      description: job.description,
      applyUrl: job.url,
      source: "linkedin",
    });
  }

  if (jobs.length > 0) return jobs;

  // Step 2: Search Naukri
  const naukriJobs = await searchNaukri(
    `frontend developer ${company}`,
    "bangalore"
  );

  const matchedNaukri = naukriJobs.filter((j) =>
    j.company.toLowerCase().includes(companyLower.slice(0, 4)) ||
    j.title.toLowerCase().includes("frontend") ||
    j.title.toLowerCase().includes("react")
  );

  for (const job of matchedNaukri.slice(0, 3)) {
    jobs.push({
      role: job.title,
      location: job.location,
      description: job.description,
      applyUrl: job.url,
      source: "naukri",
    });
  }

  if (jobs.length > 0) return jobs;

  // Step 3: Generic LinkedIn search (not company-specific)
  const genericLinkedIn = await searchLinkedIn("frontend engineer react", "India");
  for (const job of genericLinkedIn.slice(0, 3)) {
    jobs.push({
      role: job.title,
      location: job.location,
      description: job.description,
      applyUrl: job.url,
      source: "linkedin",
    });
  }

  return jobs;
}

// --- Exports for Live Feed page ---

export async function searchJobsFeed(
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
    source: string;
  }>
> {
  const [linkedInJobs, naukriJobs] = await Promise.all([
    searchLinkedIn(query, location),
    searchNaukri(query, location),
  ]);

  const results = [
    ...linkedInJobs.map((j) => ({
      title: j.title,
      company: j.company,
      location: j.location,
      salary: "",
      url: j.url,
      description: j.description,
      source: "LinkedIn",
    })),
    ...naukriJobs.map((j) => ({
      title: j.title,
      company: j.company,
      location: j.location,
      salary: j.salary,
      url: j.url,
      description: j.description,
      source: "Naukri",
    })),
  ];

  return results;
}

function extractLocation(text: string): string {
  const locationPatterns = [
    /(?:location|based in|office)[:\s]*(bengaluru|bangalore|hyderabad|pune|mumbai|chennai|gurgaon|noida|remote)/i,
    /(bengaluru|bangalore|hyderabad|pune|mumbai|chennai|gurgaon|noida|remote)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return "India";
}
