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

export async function generateTailoredResume(prompt: string): Promise<{
  changes: Array<{ section: string; before: string; after: string; reason: string }>;
  html: string;
}> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are a resume tailoring expert. You MUST output ONLY valid JSON. No markdown, no code fences, no explanation. Just the JSON object.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 8192,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0]?.message?.content || "{}";

  const cleanJson = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  return JSON.parse(cleanJson);
}

export function buildTailorPrompt(
  resumeHtml: string,
  company: string,
  role: string,
  jobDescription: string
): string {
  return `You MUST modify the EXACT HTML resume provided below. Do NOT create a new resume. Do NOT invent new content.

CRITICAL RULES:
1. The output MUST contain the candidate's real name: "Brijesh M Patil"
2. The output MUST contain the real email: "brijeshmpatil77@gmail.com"
3. The output MUST contain the real company: "ShopTrade"
4. NEVER invent fake companies, fake names, fake emails, or fake experience
5. ONLY modify text content inside the existing HTML tags — keep all HTML structure, CSS, and classes EXACTLY as-is
6. You may reorder skill tags, rephrase bullet points, and adjust the summary paragraph to better match the JD
7. If the job description is too short or vague, make MINIMAL changes only
8. The output MUST be a valid complete HTML document starting with <!DOCTYPE html>
9. Keep ALL existing sections — do not remove any content

COMPANY: ${company}
ROLE: ${role}

JOB DESCRIPTION:
${jobDescription}

BASE RESUME HTML (modify THIS document, do NOT create new):
${resumeHtml}

Respond with this JSON structure:
{
  "changes": [
    {
      "section": "Summary|Experience|Skills|Projects",
      "before": "original text from the resume",
      "after": "modified text",
      "reason": "why this change helps match the JD"
    }
  ],
  "html": "the COMPLETE modified HTML document starting with <!DOCTYPE html>"
}`;
}

export function validateTailoredResume(html: string): boolean {
  return (
    html.includes("Brijesh") &&
    html.includes("brijeshmpatil77") &&
    html.includes("ShopTrade")
  );
}
