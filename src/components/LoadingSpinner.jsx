import React from "react";

export default function LoadingSpinner({ message = "Loading…" }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      style={{ minHeight: 220 }}
    >
      {/* Dual-ring spinner */}
      <div className="relative w-12 h-12">
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: "3px solid var(--border)" }}
        />
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            border: "3px solid transparent",
            borderTopColor: "var(--accent)",
          }}
        />
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
        {message}
      </p>
    </div>
  );
}
