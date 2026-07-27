"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, apiPost } from "@/lib/api";
import {
  Plus,
  Search,
  ExternalLink,
  ChevronDown,
  Trash2,
  MapPin,
  Building2,
  IndianRupee,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { AddJobModal } from "@/components/AddJobModal";
import type { JobWithApplication, ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUS_LABELS } from "@/lib/types";

export default function TrackerPage() {
  return (
    <Suspense fallback={<div className="p-8 min-h-[50vh] text-gray-500">Loading...</div>}>
      <TrackerContent />
    </Suspense>
  );
}

function TrackerContent() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobWithApplication[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState(searchParams.get("type") || "");
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("type", filterType);

    const res = await apiFetch(`/api/tracker?${params}`);
    const data = await res.json();
    setJobs(data.jobs);
    setLoading(false);
  }, [search, filterStatus, filterType]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleAddJob = async (job: {
    company: string;
    role: string;
    type: string;
    location: string;
    salary_min: number | undefined;
    salary_max: number | undefined;
    apply_url: string;
    description: string;
    notes: string;
  }) => {
    await apiPost("/api/tracker", { action: "create", ...job });
    fetchJobs();
  };

  const handleStatusChange = async (
    jobId: string,
    status: ApplicationStatus
  ) => {
    await apiPost("/api/tracker", { action: "update_status", job_id: jobId, status });
    setStatusDropdown(null);
    fetchJobs();
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Delete this job?")) return;
    await apiPost("/api/tracker", { action: "delete", id: jobId });
    fetchJobs();
  };

  const allStatuses = Object.keys(
    APPLICATION_STATUS_LABELS
  ) as ApplicationStatus[];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Application Tracker
          </h1>
          <p className="text-gray-500 mt-1">
            {jobs.length} jobs in your pipeline
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Job
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or role..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2.5 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          <option value="Product">Product</option>
          <option value="MNC">MNC</option>
          <option value="Mid-Corp">Mid-Corp</option>
          <option value="Consulting">Consulting</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 min-h-[50vh] text-gray-500">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No jobs found</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-indigo-600 text-sm font-medium hover:underline"
          >
            Add your first job
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white border rounded-xl p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">
                    {job.company}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{job.role}</div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {job.location && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                      </span>
                    )}
                    {job.type && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Building2 className="w-3 h-3" />
                        {job.type}
                      </span>
                    )}
                    {(job.salary_min || job.salary_max) && (
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <IndianRupee className="w-3 h-3" />
                        {job.salary_min || "?"}–{job.salary_max || "?"} LPA
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {job.apply_url && (
                    <a
                      href={
                        job.apply_url.startsWith("http")
                          ? job.apply_url
                          : `https://${job.apply_url}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <div className="relative">
                  <button
                    onClick={() =>
                      setStatusDropdown(
                        statusDropdown === job.id ? null : job.id
                      )
                    }
                    className="flex items-center gap-1"
                  >
                    <StatusBadge
                      status={job.application?.status || "not_applied"}
                    />
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                  {statusDropdown === job.id && (
                    <div className="absolute z-20 mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-[160px]">
                      {allStatuses.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(job.id, s)}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                        >
                          {APPLICATION_STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {job.hiring_status && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      job.hiring_status.includes("CONFIRMED")
                        ? "bg-green-50 text-green-700"
                        : job.hiring_status.includes("NO")
                          ? "bg-red-50 text-red-700"
                          : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {job.hiring_status.includes("CONFIRMED")
                      ? "Open"
                      : job.hiring_status.includes("NO")
                        ? "Closed"
                        : "Check"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddJobModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddJob}
      />
    </div>
  );
}
