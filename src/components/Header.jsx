import React from "react";

export default function Header({ title, subtitle }) {
  return (
    <div
      className="mb-6 pb-4 flex items-start justify-between"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div>
        <h2
          className="text-2xl font-bold leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
