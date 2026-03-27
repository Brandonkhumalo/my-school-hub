/**
 * Date formatting utilities for Zimbabwe (Africa/Harare timezone)
 * Format: DD/MM/YYYY (en-GB locale)
 * API returns dates in DD-MM-YYYY format
 */

// Parse date string — handles DD-MM-YYYY (API format), YYYY-MM-DD (ISO), and other formats
export function parseDate(dateString) {
  if (!dateString) return null;
  // Match DD-MM-YYYY format from API (date only)
  const ddmmyyyy = dateString.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    return new Date(ddmmyyyy[3], ddmmyyyy[2] - 1, ddmmyyyy[1]);
  }
  // Match DD-MM-YYYY HH:MM:SS format from API (datetime)
  const ddmmyyyyTime = dateString.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (ddmmyyyyTime) {
    return new Date(ddmmyyyyTime[3], ddmmyyyyTime[2] - 1, ddmmyyyyTime[1], ddmmyyyyTime[4], ddmmyyyyTime[5], ddmmyyyyTime[6] || 0);
  }
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// Short date: 26-03-2026
export function formatDate(dateString) {
  const date = parseDate(dateString);
  if (!date) return dateString || "";
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

// Long date: 26 March 2026
export function formatDateLong(dateString) {
  const date = parseDate(dateString);
  if (!date) return dateString || "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Full date with weekday: Wednesday, 26 March 2026
export function formatDateFull(dateString) {
  const date = parseDate(dateString);
  if (!date) return dateString || "";
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Short month: 26 Mar 2026
export function formatDateShort(dateString) {
  const date = parseDate(dateString);
  if (!date) return dateString || "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Date and time: 26/03/2026 14:30
export function formatDateTime(dateString) {
  const date = parseDate(dateString);
  if (!date) return dateString || "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Time only: 14:30
export function formatTime(dateString) {
  const date = parseDate(dateString);
  if (!date) return dateString || "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Relative time: "2 days ago", "just now", "in 3 hours"
export function formatRelative(dateString) {
  const date = parseDate(dateString);
  if (!date) return dateString || "";
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  return formatDate(dateString);
}
