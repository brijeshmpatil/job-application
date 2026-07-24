"use client";

import { Search, MapPin, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function JobSearchPage() {
  const [query, setQuery] = useState("frontend engineer react");
  const [location, setLocation] = useState("India");
  const [results, setResults] = useState<
    Array<{
      title: string;
      company: string;
      location: string;
      salary: string;
      url: string;
      description: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ query, location });
      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      setResults(data.jobs || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const saveToTracker = async (job: {
    title: string;
    company: string;
    location: string;
    url: string;
    description: string;
  }) => {
    await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        company: job.company,
        role: job.title,
        location: job.location,
        apply_url: job.url,
        description: job.description,
        source: "search",
      }),
    });
    alert(`Saved "${job.company} - ${job.title}" to tracker`);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Search Jobs</h1>
        <p className="text-gray-500 mt-1">
          Find frontend roles from public job APIs
        </p>
      </div>

      <div className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="frontend engineer react typescript..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div className="relative w-48">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">
          Searching job APIs...
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">No results found</p>
          <p className="text-sm text-gray-400">
            Try different keywords or check API keys in .env.local
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {results.length} results found
          </p>
          {results.map((job, i) => (
            <div
              key={i}
              className="bg-white border rounded-xl p-5 hover:border-indigo-200 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{job.title}</h3>
                  <p className="text-sm text-gray-600 mt-0.5">{job.company}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                      </span>
                    )}
                    {job.salary && <span>{job.salary}</span>}
                  </div>
                  {job.description && (
                    <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                      {job.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => saveToTracker(job)}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    Save to Tracker
                  </button>
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && (
        <div className="bg-white border rounded-xl p-8 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">
            Search for jobs across multiple APIs
          </p>
          <p className="text-xs text-gray-400">
            Uses Adzuna and FindWork.dev APIs. Set API keys in .env.local for
            best results.
          </p>
        </div>
      )}
    </div>
  );
}
