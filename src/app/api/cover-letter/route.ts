import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const RAVER_DIR = path.join(process.env.HOME || "", "Desktop/RaveR");

export async function POST(request: NextRequest) {
  const { company, role, description, location } = await request.json();

  if (!company || !role) {
    return Response.json({ error: "Company and role required" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
  }

  const client = new Groq({ apiKey });

  const prompt = `Write a professional cover letter for Brijesh M Patil applying to ${company} for the role of ${role}.

CANDIDATE INFO:
- Name: Brijesh M Patil
- Email: brijeshmpatil77@gmail.com
- Phone: +91 7815840654
- LinkedIn: linkedin.com/in/brijeshmpatil77
- Location: Bengaluru, India
- Current role: SDE 2 — Frontend Engineer & Team Lead at ShopTrade (3+ years)
- Leads a 3-engineer frontend team
- Built 11 production web apps for global brands (React, TypeScript)
- Built TypeScript component library (50+ primitives) used across 4 projects
- Engineered data-driven rendering engine powering 1,000+ pages
- Built chunked file upload system (1GB+ files, S3, Lambda)
- Drove Core Web Vitals optimization — LCP reduced 40%, Lighthouse 90+
- Delivered WCAG 2.1 AA compliance (focus trapping, ARIA, screen readers)
- Designed scroll-driven animation systems (GSAP, 60fps on mobile)
- Created B2B/B2C dual-interface architecture
- Skills: TypeScript, React, Next.js, Tailwind, GSAP, Webpack, Vite, AWS S3/Lambda, REST APIs, Git, Playwright, CI/CD
- Education: MCA from Gogte Institute of Technology

COMPANY: ${company}
ROLE: ${role}
LOCATION: ${location || "India"}
JOB DESCRIPTION: ${(description || "Frontend developer role").slice(0, 2000)}

RULES:
1. Keep it concise — fit on ONE page
2. Map candidate's experience directly to JD requirements
3. Use specific numbers and achievements (40% LCP, 11 apps, 50+ primitives)
4. Be honest — if JD asks for skills candidate doesn't have, mention eagerness to learn
5. Professional but not robotic — show genuine interest
6. Do NOT fabricate any experience

Output ONLY the cover letter body text (no HTML). Use these sections:
- Opening paragraph (interest + headline match)
- 3-4 short paragraphs mapping experience to JD
- Closing paragraph
- Sign off with name`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You write concise, professional cover letters. Output plain text only, no markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const letterText = completion.choices[0]?.message?.content || "";

    // Build HTML
    const today = new Date().toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cover Letter — ${company}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      color: #1E1B4B;
      line-height: 1.75;
      font-size: 11pt;
      padding: 60px 70px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header { margin-bottom: 24px; }
    .name { font-size: 22pt; font-weight: 700; color: #6C3CE1; }
    .contact { font-size: 9pt; color: #64748B; margin-top: 4px; }
    .date { font-size: 10pt; color: #64748B; margin-top: 16px; }
    .to { font-size: 10pt; color: #475569; margin-top: 6px; line-height: 1.5; }
    .subject { font-size: 11pt; font-weight: 600; margin-top: 16px; color: #1E1B4B; }
    .body { margin-top: 16px; white-space: pre-wrap; }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">Brijesh M Patil</div>
    <div class="contact">brijeshmpatil77@gmail.com · +91 7815840654 · linkedin.com/in/brijeshmpatil77 · Bengaluru, India</div>
  </div>
  <div class="date">${today}</div>
  <div class="to">Hiring Manager<br>${company}<br>${location || "India"}</div>
  <div class="subject">Re: ${role}</div>
  <div class="body">${letterText}</div>
</body>
</html>`;

    // Generate PDF
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await browser.close();

    // Save to Desktop/RaveR
    const cleanName = company.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Cover_Letter_${cleanName}.pdf`;
    mkdirSync(RAVER_DIR, { recursive: true });
    writeFileSync(path.join(RAVER_DIR, filename), pdfBuffer);
    writeFileSync(path.join(RAVER_DIR, `Cover_Letter_${cleanName}.html`), html);

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Cover letter error:", err);
    return Response.json(
      { error: "Failed to generate cover letter." },
      { status: 500 }
    );
  }
}
