/**
 * Career page scraper — tries company website first, falls back to APIs.
 *
 * Strategy:
 * 1. Try known career page patterns (company.com/careers, jobs.company.com)
 * 2. Scrape for frontend/React/TypeScript job listings
 * 3. Fall back to Adzuna API search
 */

interface ScrapedJob {
  role: string;
  location: string;
  description: string;
  applyUrl: string;
  source: "career_page" | "adzuna" | "findwork";
}

const CAREER_PAGE_PATTERNS = [
  "/careers",
  "/jobs",
  "/company/careers",
  "/en/careers",
  "/about/careers",
  "/company/careers/open-positions",
];

// Known career page URLs for popular companies
const KNOWN_CAREER_URLS: Record<string, string[]> = {
  atlassian: ["https://www.atlassian.com/company/careers/all-jobs"],
  razorpay: ["https://razorpay.com/careers/", "https://razorpay.com/tech/"],
  postman: ["https://www.postman.com/company/careers/open-positions/"],
  cred: ["https://careers.cred.club/openings"],
  swiggy: ["https://careers.swiggy.in/"],
  flipkart: ["https://www.flipkartcareers.com/"],
  myntra: ["https://careers.myntra.com/"],
  groww: ["https://groww.in/careers"],
  zerodha: ["https://zerodha.com/careers/"],
  freshworks: ["https://careers.smartrecruiters.com/Freshworks"],
  salesforce: ["https://careers.salesforce.com/en/jobs/?search=&country=India"],
  microsoft: ["https://careers.microsoft.com/v2/global/en/locations/bengaluru.html"],
  google: ["https://www.google.com/about/careers/applications/jobs/results/?location=Bangalore%20India"],
  uber: ["https://jobs.uber.com/en/jobs/?location=Bengaluru"],
  gojek: ["https://www.gojek.io/careers"],
  tekion: ["https://tekion.com/careers"],
  godaddy: ["https://careers.godaddy.com/search-results"],
  commvault: ["https://careers.commvault.com/us/en/search-results"],
  cisco: ["https://jobs.cisco.com/jobs/SearchJobs"],
  adobe: ["https://careers.adobe.com/us/en/search-results"],
  intuit: ["https://www.intuit.com/in/careers/"],
  browserstack: ["https://www.browserstack.com/careers"],
  lenskart: ["https://careers.lenskart.com/"],
  phonepe: ["https://www.phonepe.com/careers/"],
  meesho: ["https://meesho.io/careers"],
};

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

function companyToBaseUrl(company: string): string[] {
  const clean = company
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

  const withDash = company
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");

  return [
    `https://www.${clean}.com`,
    `https://${clean}.com`,
    `https://www.${withDash}.com`,
    `https://${withDash}.com`,
    `https://careers.${clean}.com`,
    `https://jobs.${clean}.com`,
  ];
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const text = await res.text();
    return text;
  } catch {
    return null;
  }
}

function extractJobListings(
  html: string,
  baseUrl: string
): Array<{ title: string; url: string }> {
  const listings: Array<{ title: string; url: string }> = [];

  // Match <a> tags with job-related href and text
  const linkRegex =
    /<a[^>]*href=["']([^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, "").trim();

    if (!text || text.length < 5 || text.length > 200) continue;

    const textLower = text.toLowerCase();
    const isFrontend = FRONTEND_KEYWORDS.some((kw) => textLower.includes(kw));

    if (isFrontend) {
      let fullUrl = href;
      if (href.startsWith("/")) {
        const urlObj = new URL(baseUrl);
        fullUrl = `${urlObj.origin}${href}`;
      } else if (!href.startsWith("http")) {
        fullUrl = `${baseUrl}/${href}`;
      }

      listings.push({ title: text, url: fullUrl });
    }
  }

  return listings;
}

async function scrapeJobDescription(url: string): Promise<string | null> {
  const html = await fetchPageContent(url);
  if (!html) return null;

  // Extract text content from the page, strip HTML
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return null;

  let text = bodyMatch[1]
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Limit to reasonable length
  if (text.length > 5000) {
    text = text.slice(0, 5000);
  }

  return text.length > 100 ? text : null;
}

export async function scrapeCompanyJobs(
  company: string,
  careersUrl?: string
): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

  // Step 1: Try provided careers URL
  if (careersUrl) {
    const html = await fetchPageContent(careersUrl);
    if (html) {
      const listings = extractJobListings(html, careersUrl);
      for (const listing of listings.slice(0, 3)) {
        const description = await scrapeJobDescription(listing.url);
        if (description) {
          jobs.push({
            role: listing.title,
            location: extractLocation(description),
            description,
            applyUrl: listing.url,
            source: "career_page",
          });
        }
      }
    }
    if (jobs.length > 0) return jobs;
  }

  // Step 2: Try known career URLs for this company
  const companyKey = company.toLowerCase().replace(/\s+/g, "");
  const knownUrls = KNOWN_CAREER_URLS[companyKey] || [];
  for (const url of knownUrls) {
    const html = await fetchPageContent(url);
    if (!html) continue;

    const listings = extractJobListings(html, url);
    for (const listing of listings.slice(0, 3)) {
      const description = await scrapeJobDescription(listing.url);
      if (description) {
        jobs.push({
          role: listing.title,
          location: extractLocation(description),
          description,
          applyUrl: listing.url,
          source: "career_page",
        });
      }
    }

    if (jobs.length > 0) return jobs;
  }

  // Step 3: Try common career page patterns on guessed URLs
  const baseUrls = companyToBaseUrl(company);
  for (const baseUrl of baseUrls) {
    for (const pattern of CAREER_PAGE_PATTERNS) {
      const url = `${baseUrl}${pattern}`;
      const html = await fetchPageContent(url);
      if (!html) continue;

      const listings = extractJobListings(html, url);
      for (const listing of listings.slice(0, 3)) {
        const description = await scrapeJobDescription(listing.url);
        if (description) {
          jobs.push({
            role: listing.title,
            location: extractLocation(description),
            description,
            applyUrl: listing.url,
            source: "career_page",
          });
        }
      }

      if (jobs.length > 0) return jobs;
    }
  }

  // Step 3: Fall back to Adzuna API (company-specific)
  const adzunaJobs = await searchAdzunaForCompany(company);
  if (adzunaJobs.length > 0) {
    jobs.push(...adzunaJobs);
    return jobs;
  }

  // Step 4: Generic frontend job search via Adzuna (not company-specific)
  const genericJobs = await searchAdzunaGeneric();
  jobs.push(...genericJobs);

  return jobs;
}

async function searchAdzunaGeneric(): Promise<ScrapedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  try {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: "5",
      what: "frontend engineer react typescript",
      where: "bangalore",
      "content-type": "application/json",
    });

    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/in/search/1?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || []).slice(0, 3).map(
      (job: {
        title: string;
        company?: { display_name?: string };
        location?: { display_name?: string };
        description?: string;
        redirect_url: string;
      }) => ({
        role: job.title,
        location: job.location?.display_name || "India",
        description: (job.description || "").slice(0, 3000),
        applyUrl: job.redirect_url,
        source: "adzuna" as const,
      })
    );
  } catch {
    return [];
  }
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

async function searchAdzunaForCompany(
  company: string
): Promise<ScrapedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  // Try company-specific search first, then generic frontend search
  const queries = [
    `frontend engineer ${company}`,
    `react developer ${company}`,
    `frontend engineer`,
  ];

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: "10",
        what: query,
        "content-type": "application/json",
      });

      const res = await fetch(
        `https://api.adzuna.com/v1/api/jobs/in/search/1?${params}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const results = (data.results || []) as Array<{
        title: string;
        company?: { display_name?: string };
        location?: { display_name?: string };
        description?: string;
        redirect_url: string;
      }>;

      // For company-specific queries, try to match company name
      const companyLower = company.toLowerCase();
      let filtered = results.filter((job) => {
        const jobCompany = job.company?.display_name?.toLowerCase() || "";
        return jobCompany.includes(companyLower.slice(0, 4));
      });

      // For generic query, skip — only return company-matched results
      if (filtered.length === 0) continue;

      if (filtered.length === 0) continue;

      return filtered.slice(0, 3).map((job) => ({
        role: job.title,
        location: job.location?.display_name || "India",
        description: job.description?.slice(0, 3000) || "",
        applyUrl: job.redirect_url,
        source: "adzuna" as const,
      }));
    } catch {
      continue;
    }
  }

  return [];
}
