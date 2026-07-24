"use client";

import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  type ApplicationStatus,
} from "@/lib/types";

interface StatusBadgeProps {
  status: ApplicationStatus;
  onClick?: () => void;
}

export function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const label = APPLICATION_STATUS_LABELS[status];
  const color = APPLICATION_STATUS_COLORS[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color} ${onClick ? "cursor-pointer hover:opacity-80" : ""}`}
      onClick={onClick}
    >
      {label}
    </span>
  );
}
