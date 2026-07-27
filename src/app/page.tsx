"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  Send,
  MessageSquare,
  Trophy,
  XCircle,
  FileText,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch("/api/tracker?action=stats")
      .then((res) => res.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Jobs",
      value: stats.total,
      icon: Briefcase,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Applied",
      value: stats.byStatus["applied"] || 0,
      icon: Send,
      color: "bg-yellow-50 text-yellow-600",
    },
    {
      label: "Interviewing",
      value:
        (stats.byStatus["screening"] || 0) +
        (stats.byStatus["interview"] || 0),
      icon: MessageSquare,
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Offers",
      value: stats.byStatus["offer"] || 0,
      icon: Trophy,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Rejected",
      value: stats.byStatus["rejected"] || 0,
      icon: XCircle,
      color: "bg-red-50 text-red-600",
    },
    {
      label: "Resume Tailored",
      value: stats.byStatus["resume_tailored"] || 0,
      icon: FileText,
      color: "bg-blue-50 text-blue-600",
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Your job application pipeline at a glance
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border p-5 flex items-center gap-4"
            >
              <div className={`p-3 rounded-lg ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-xl border p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">By Company Type</h2>
          <div className="space-y-3">
            {Object.entries(stats.byType).map(([type, count]) => (
              <a
                key={type}
                href={`/tracker?type=${encodeURIComponent(type)}`}
                className="flex items-center justify-between hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors cursor-pointer"
              >
                <span className="text-sm text-gray-600 hover:text-indigo-600">{type}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-indigo-600 rounded-full h-2"
                      style={{
                        width: `${(count / stats.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">
                    {count}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a
              href="/tracker"
              className="block px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-medium text-indigo-700 transition-colors"
            >
              View All Applications →
            </a>
            <a
              href="/jobs"
              className="block px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg text-sm font-medium text-green-700 transition-colors"
            >
              Search New Jobs →
            </a>
            <a
              href="/resume"
              className="block px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium text-blue-700 transition-colors"
            >
              Manage Resume →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
