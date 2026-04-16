import React from "react";

// Gradient pairs for the icon bubble
const GRAD_MAP = {
  "from-blue-500 to-blue-700":     { from: "#3b82f6", to: "#1d4ed8" },
  "from-green-500 to-green-700":   { from: "#22c55e", to: "#15803d" },
  "from-emerald-500 to-emerald-700":{ from: "#10b981", to: "#047857" },
  "from-purple-500 to-purple-700": { from: "#a855f7", to: "#7e22ce" },
  "from-orange-500 to-orange-700": { from: "#f97316", to: "#c2410c" },
  "from-rose-500 to-rose-700":     { from: "#f43f5e", to: "#be123c" },
  "from-teal-500 to-teal-700":     { from: "#14b8a6", to: "#0f766e" },
  "from-amber-500 to-amber-700":   { from: "#f59e0b", to: "#b45309" },
  "from-indigo-500 to-indigo-700": { from: "#6366f1", to: "#4338ca" },
};

function DashboardCard({ title, value, icon, gradient = "from-blue-500 to-blue-700", trend, trendLabel }) {
  const g = GRAD_MAP[gradient] || { from: "#3b82f6", to: "#1d4ed8" };

  return (
    <div
      className="portal-card p-6 flex items-start justify-between gap-4"
      style={{ borderRadius: "1rem" }}
    >
      {/* Text */}
      <div className="min-w-0">
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-1 truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </p>
        <h3
          className="text-3xl font-bold leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          {value ?? "—"}
        </h3>
        {trend !== undefined && (
          <p
            className={`text-xs mt-2 font-medium ${trend >= 0 ? "text-emerald-500" : "text-rose-500"}`}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%{trendLabel ? ` ${trendLabel}` : ""}
          </p>
        )}
      </div>

      {/* Icon bubble */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
          boxShadow: `0 4px 14px ${g.from}55`,
        }}
      >
        <i className={`${icon} text-white text-xl`} />
      </div>
    </div>
  );
}

export default DashboardCard;
