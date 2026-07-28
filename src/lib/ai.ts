import Groq from "groq-sdk";

let _client: Groq | null = null;

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set in .env.local");
  if (!_client) {
    _client = new Groq({ apiKey });
  }
  return _client;
}

interface ResumeChange {
  section: string;
  find: string;
  replace: string;
  reason: string;
}

/**
 * Ask AI to generate text-level replacements (NOT full HTML).
 * We apply these to the original HTML ourselves — preserving all styling.
 */
export async function generateResumeChanges(
  resumeHtml: string,
  company: string,
  role: string,
  jobDescription: string
): Promise<{ changes: ResumeChange[]; html: string }> {
  const client = getClient();

  const prompt = `You are a resume tailoring expert. Analyze the job description and suggest text replacements for the resume below.

RULES:
1. Output a list of find-and-replace operations on the resume text
2. Each "find" must be an EXACT substring from the resume HTML below — copy it character-for-character
3. Each "replace" is the modified version of that text
4. NEVER invent fake experience, companies, or skills
5. ONLY rephrase, reorder emphasis, or adjust wording to match the JD
6. Keep changes minimal and impactful — 3 to 6 changes max
7. Focus on: summary paragraph, bullet point text, skill tag order

NEVER CHANGE THESE (keep exactly as-is):
- Job titles: "SDE 2 — Frontend Engineer & Team Lead", "SDE 1 — Frontend Engineer"
- Company name: "ShopTrade"
- Dates: "Apr 2026 – Present", "Sep 2023 – May 2026"
- Education details
- Contact info (name, email, phone, LinkedIn)
- Project names (Jatai, Solefly, StickersBanners, Fire The Imagination)

COMPANY: ${company}
ROLE: ${role}

JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

RESUME HTML:
${resumeHtml}

Respond with ONLY this JSON:
{
  "changes": [
    {
      "section": "Summary|Experience|Skills",
      "find": "exact text from the resume to find",
      "replace": "replacement text",
      "reason": "why this change helps"
    }
  ]
}`;

  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You output ONLY valid JSON. Each 'find' value must be an exact substring from the provided HTML. No markdown fences.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(responseText);
  const changes: ResumeChange[] = parsed.changes || [];

  // Apply changes to original HTML
  let tailoredHtml = resumeHtml;
  const appliedChanges: ResumeChange[] = [];

  for (const change of changes) {
    if (!change.find || !change.replace || change.find === change.replace) continue;

    // Only apply if the exact text exists in the HTML
    if (tailoredHtml.includes(change.find)) {
      tailoredHtml = tailoredHtml.replace(change.find, change.replace);
      appliedChanges.push(change);
    }
  }

  return {
    changes: appliedChanges,
    html: tailoredHtml,
  };
}

export function validateTailoredResume(html: string): boolean {
  return (
    html.includes("Brijesh") &&
    html.includes("brijeshmpatil77") &&
    html.includes("ShopTrade")
  );
}
