"use client";

import { useState } from "react";
import { FileText, Wand2, Download, Eye } from "lucide-react";

export default function ResumePage() {
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [result, setResult] = useState<{
    changes: Array<{ section: string; before: string; after: string; reason: string }>;
    html: string;
  } | null>(null);

  const handleTailor = async () => {
    if (!jobDescription.trim()) return;
    setTailoring(true);
    try {
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          companyName,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Tailoring failed:", err);
    }
    setTailoring(false);
  };

  const handleExportPdf = async () => {
    if (!result?.html) return;
    try {
      const res = await fetch("/api/resume/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: result.html, companyName }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Brijesh_M_Patil_Resume_${companyName || "tailored"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Resume Tailoring</h1>
        <p className="text-gray-500 mt-1">
          Paste a job description to generate a tailored resume
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="Razorpay"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Description *
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={16}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="Paste the full job description here..."
            />
          </div>
          <button
            onClick={handleTailor}
            disabled={tailoring || !jobDescription.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors w-full justify-center"
          >
            <Wand2 className="w-4 h-4" />
            {tailoring ? "Tailoring with AI..." : "Tailor Resume"}
          </button>
        </div>

        {/* Output */}
        <div>
          {!result && !tailoring && (
            <div className="bg-white border rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
              <FileText className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-500 mb-2">No tailored resume yet</p>
              <p className="text-xs text-gray-400">
                Paste a JD and click &quot;Tailor Resume&quot; to generate
              </p>
            </div>
          )}

          {tailoring && (
            <div className="bg-white border rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mb-4" />
              <p className="text-gray-500">Analyzing JD and tailoring resume...</p>
              <p className="text-xs text-gray-400 mt-1">This may take 10-15 seconds</p>
            </div>
          )}

          {result && !tailoring && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Changes Made</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const w = window.open();
                      if (w) {
                        w.document.write(result.html);
                        w.document.close();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {result.changes.map((change, i) => (
                  <div
                    key={i}
                    className="bg-white border rounded-lg p-4 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                        {change.section}
                      </span>
                      <span className="text-xs text-gray-400">
                        {change.reason}
                      </span>
                    </div>
                    {change.before && (
                      <div className="bg-red-50 border-l-2 border-red-300 px-3 py-2 mb-2 text-xs text-red-800 line-through">
                        {change.before}
                      </div>
                    )}
                    <div className="bg-green-50 border-l-2 border-green-300 px-3 py-2 text-xs text-green-800">
                      {change.after}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
