import { NextRequest } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const RAVER_DIR = path.join(process.env.HOME || "", "Desktop/RaveR");

export async function POST(request: NextRequest) {
  const { html, companyName } = await request.json();

  if (!html) {
    return Response.json({ error: "HTML content required" }, { status: 400 });
  }

  try {
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

    const cleanName = (companyName || "tailored").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Brijesh_M_Patil_Resume_${cleanName}.pdf`;

    // Save to Desktop/RaveR
    mkdirSync(RAVER_DIR, { recursive: true });
    const savePath = path.join(RAVER_DIR, filename);
    writeFileSync(savePath, pdfBuffer);

    // Also save tailored HTML
    const htmlFilename = `${cleanName}_tailored_resume.html`;
    writeFileSync(path.join(RAVER_DIR, htmlFilename), html);

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Saved-Path": savePath,
      },
    });
  } catch (err) {
    console.error("PDF export error:", err);
    return Response.json(
      { error: "Failed to generate PDF." },
      { status: 500 }
    );
  }
}
