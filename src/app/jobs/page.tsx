"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MapPin,
  RefreshCw,
  Zap,
  Building2,
  Check,
  Filter,
} from "lucide-react";

interface FeedJob {
  title: string;
  company: string;
  location: string;
  salary: string;
  url: string;
  description: string;
  source: string;
}

export default function JobFeedPage() {
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [query, setQuery] = useState("frontend engineer react");
  const [location, setLocation] = useState("India");
  const [pushed, setPushed] = useState<Set<number>>(new Set());

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ query, location });
      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      setJobs(data.jobs || []);
      setLastRefresh(new Date().toLocaleTimeString());
      setSelectedJobs(new Set());
      setPushed(new Set());
    } catch {
      setJobs([]);
    }
    setLoading(false);
  }, [query, location]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const toggleSelect = (index: number) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map((_, i) => i)));
    }
  };

  const pushToPipeline = async () => {
    const selected = jobs.filter((_, i) => selectedJobs.has(i));
    if (selected.length === 0) return;

    for (const job of selected) {
      await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          company: job.company,
          job_url: job.url,
          role: job.title,
        }),
      });
    }

    setPushed(new Set(selectedJobs));
    setSelectedJobs(new Set());
  };

  const jobTypes = [
    "frontend engineer react",
    "frontend developer typescript",
    "react developer",
    "UI engineer",
    "frontend engineer next.js",
    "web developer react",
  ];

  const locations = [
    "India",
    "Bangalore",
    "Remote",
    "Hyderabad",
    "Pune",
    "Mumbai",
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Job Feed</h1>
          <p className="text-gray-500 mt-1">
            Auto-fetched jobs matching your profile. Select → Push to Pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              Updated: {lastRefresh}
            </span>
          )}
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Search controls */}
      <div className="bg-white border rounded-xl p-5 mb-6">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search query..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && fetchJobs()}
            />
          </div>
          <div className="relative w-44">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Quick filters */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-400 py-1">
            <Filter className="w-3 h-3 inline mr-1" />
            Quick:
          </span>
          {jobTypes.map((jt) => (
            <button
              key={jt}
              onClick={() => {
                setQuery(jt);
                setTimeout(fetchJobs, 100);
              }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                query === jt
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {jt}
            </button>
          ))}
          <span className="text-xs text-gray-300 py-1">|</span>
          {locations.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                setLocation(loc);
                setTimeout(fetchJobs, 100);
              }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                location === loc
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      {jobs.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={selectAll}
              className="text-xs text-indigo-600 hover:underline"
            >
              {selectedJobs.size === jobs.length ? "Deselect All" : "Select All"}
            </button>
            <span className="text-xs text-gray-400">
              {selectedJobs.size} selected of {jobs.length}
            </span>
          </div>
          {selectedJobs.size > 0 && (
            <button
              onClick={pushToPipeline}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Push {selectedJobs.size} to Pipeline
            </button>
          )}
        </div>
      )}

      {/* Job listings */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Fetching jobs from APIs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 bg-white border rounded-xl">
          <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500">No jobs found. Try different keywords.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <div
              key={i}
              className={`bg-white border rounded-xl p-4 transition-all cursor-pointer ${
                selectedJobs.has(i)
                  ? "border-indigo-300 ring-1 ring-indigo-200 bg-indigo-50/30"
                  : pushed.has(i)
                    ? "border-green-300 bg-green-50/30 opacity-60"
                    : "hover:border-gray-300"
              }`}
              onClick={() => !pushed.has(i) && toggleSelect(i)}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div
                  className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    pushed.has(i)
                      ? "bg-green-500 border-green-500"
                      : selectedJobs.has(i)
                        ? "bg-indigo-600 border-indigo-600"
                        : "border-gray-300"
                  }`}
                >
                  {(selectedJobs.has(i) || pushed.has(i)) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {job.title}
                      </h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {job.company}
                      </p>
                    </div>
                    {pushed.has(i) && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        In Pipeline
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                      </span>
                    )}
                    {job.salary && <span>{job.salary}</span>}
                    <span className="text-gray-300">
                      via {job.source || "API"}
                    </span>
                  </div>

                  {job.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                      {job.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
