"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, apiPost } from "@/lib/api";
import {
  Play,
  Plus,
  Eye,
  Check,
  X,
  Trash2,
  ExternalLink,
  Loader2,
  Zap,
  RefreshCw,
} from "lucide-react";
import type { PipelineItem } from "@/lib/types";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
} from "@/lib/types";

export default function PipelinePage() {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [companyInput, setCompanyInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewCompany, setPreviewCompany] = useState("");

  const fetchItems = useCallback(async () => {
    const res = await apiFetch("/api/pipeline");
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Auto-refresh every 3 seconds while processing
  useEffect(() => {
    if (!processing) return;
    const interval = setInterval(fetchItems, 3000);
    return () => clearInterval(interval);
  }, [processing, fetchItems]);

  const addCompany = async () => {
    if (!companyInput.trim()) return;
    await apiPost("/api/pipeline", { action: "add", company: companyInput.trim() });
    setCompanyInput("");
    fetchItems();
  };

  const addBulk = async () => {
    const companies = bulkInput
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    if (companies.length === 0) return;

    await apiPost("/api/pipeline", { action: "add_bulk", companies });
    setBulkInput("");
    setShowBulk(false);
    fetchItems();
  };

  const runLoop = async () => {
    setProcessing(true);
    try {
      await apiPost("/api/pipeline", { action: "run_loop" });
    } finally {
      setProcessing(false);
      fetchItems();
    }
  };

  const approveItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const cleanCompany = item.company.replace(/\s+/g, "_");

    // Step 1: Download tailored resume PDF
    if (item.tailored_html) {
      try {
        const pdfRes = await apiPost("/api/resume/export", {
          html: item.tailored_html,
          companyName: item.company,
        });
        const blob = await pdfRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Brijesh_M_Patil_Resume_${cleanCompany}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // Resume PDF failed — continue
      }
    }

    // Step 2: Generate and download cover letter PDF
    try {
      const clRes = await apiPost("/api/cover-letter", {
        company: item.company,
        role: item.role || "Frontend Engineer",
        description: item.description || "",
        location: item.location || "India",
      });
      if (clRes.ok) {
        const blob = await clRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Cover_Letter_${cleanCompany}.pdf`;
        setTimeout(() => {
          a.click();
          URL.revokeObjectURL(url);
        }, 500);
      }
    } catch {
      // Cover letter failed — continue
    }

    // Step 3: Approve and get apply URL
    const res = await apiPost("/api/pipeline", { action: "approve", id });
    const data = await res.json();

    // Step 4: Open apply link
    if (data.apply_url) {
      setTimeout(() => {
        window.open(
          data.apply_url.startsWith("http")
            ? data.apply_url
            : `https://${data.apply_url}`,
          "_blank"
        );
      }, 1500);
    }
    fetchItems();
  };

  const skipItem = async (id: string) => {
    await apiPost("/api/pipeline", { action: "skip", id });
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await apiPost("/api/pipeline", { action: "delete", id });
    fetchItems();
  };

  const previewResume = (item: PipelineItem) => {
    if (item.tailored_html) {
      setPreviewHtml(item.tailored_html);
      setPreviewCompany(item.company);
    }
  };

  const readyItems = items.filter((i) => i.stage === "ready");
  const processingItems = items.filter((i) =>
    ["queued", "scraping", "scraped", "tailoring"].includes(i.stage)
  );
  const doneItems = items.filter((i) =>
    ["approved", "applied", "skipped", "failed"].includes(i.stage)
  );

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <button
            onClick={runLoop}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {processing ? "Processing..." : "Run Pipeline"}
          </button>
        </div>
        <p className="text-gray-500 mt-1 text-sm">
          Add companies → auto-scrape → auto-tailor → you approve → apply
        </p>
      </div>

      {/* Add Company */}
      <div className="bg-white border rounded-xl p-5 mb-6">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            placeholder="Company name (e.g., Razorpay)"
            className="flex-1 px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === "Enter" && addCompany()}
          />
          <button
            onClick={addCompany}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="px-3 py-2.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            Bulk Add
          </button>
        </div>

        {showBulk && (
          <div className="mt-3">
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
              placeholder={"Razorpay\nCRED\nSwiggy\nFlipkart\n(one company per line)"}
            />
            <button
              onClick={addBulk}
              className="mt-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Add All
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 min-h-[50vh] text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border rounded-xl">
          <Zap className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Pipeline is empty</p>
          <p className="text-sm text-gray-400">
            Add company names above, then click &quot;Run Pipeline&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ready for Review */}
          {readyItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-green-700">
                  Ready for Review
                </h2>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  {readyItems.length}
                </span>
              </div>
              <div className="space-y-3">
                {readyItems.map((item) => {
                  const changes = item.tailored_changes
                    ? JSON.parse(item.tailored_changes)
                    : [];
                  return (
                    <div
                      key={item.id}
                      className="bg-white border-2 border-green-200 rounded-xl p-5"
                    >
                      <div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {item.company}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {item.role || "Frontend Engineer"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {item.location && (
                              <span className="text-xs text-gray-500">
                                {item.location}
                              </span>
                            )}
                            {item.source && (
                              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                                via {item.source}
                              </span>
                            )}
                          </div>

                          {/* Changes summary */}
                          {changes.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium text-gray-500">
                                {changes.length} resume changes:
                              </p>
                              {changes.slice(0, 3).map(
                                (
                                  c: {
                                    section: string;
                                    reason: string;
                                  },
                                  i: number
                                ) => (
                                  <div
                                    key={i}
                                    className="text-xs text-gray-600 pl-3 border-l-2 border-indigo-200"
                                  >
                                    <span className="font-medium text-indigo-600">
                                      {c.section}:
                                    </span>{" "}
                                    {c.reason}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                          <button
                            onClick={() => previewResume(item)}
                            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                          >
                            <Eye className="w-4 h-4" />
                            Preview
                          </button>
                          <button
                            onClick={() => approveItem(item.id)}
                            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                            Approve & Apply
                          </button>
                          <button
                            onClick={() => skipItem(item.id)}
                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg ml-auto"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Processing */}
          {processingItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-yellow-700">
                  Processing
                </h2>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                  {processingItems.length}
                </span>
                <button
                  onClick={runLoop}
                  disabled={processing}
                  className="ml-2 p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg"
                  title="Process next batch"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${processing ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full">
                  <tbody className="divide-y">
                    {processingItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.company}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.role || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${PIPELINE_STAGE_COLORS[item.stage]}`}
                          >
                            {PIPELINE_STAGE_LABELS[item.stage]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Done / Failed */}
          {doneItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-gray-500">
                  Completed
                </h2>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  {doneItems.length}
                </span>
              </div>
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full">
                  <tbody className="divide-y">
                    {doneItems.map((item) => (
                      <tr key={item.id} className="opacity-60">
                        <td className="px-4 py-2.5 text-sm text-gray-700">
                          {item.company}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">
                          {item.role || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${PIPELINE_STAGE_COLORS[item.stage]}`}
                          >
                            {PIPELINE_STAGE_LABELS[item.stage]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-red-500 max-w-xs truncate">
                          {item.error || ""}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            {item.job_url && (
                              <a
                                href={item.job_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resume Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                Tailored Resume — {previewCompany}
              </h2>
              <button
                onClick={() => setPreviewHtml(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[75vh] border-0"
                title="Resume Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
