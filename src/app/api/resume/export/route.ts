import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { html, companyName } = await request.json();

  if (!html) {
    return Response.json({ error: "HTML content required" }, { status: 400 });
  }

  try {
    // Dynamic import to avoid loading puppeteer at startup
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

    const filename = `Brijesh_M_Patil_Resume_${companyName || "tailored"}.pdf`;

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("PDF export error:", err);
    return Response.json(
      { error: "Failed to generate PDF. Ensure puppeteer is installed." },
      { status: 500 }
    );
  }
}
