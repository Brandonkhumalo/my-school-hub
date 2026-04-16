import React from "react";

export default function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPrevious,
  onNext,
}) {
  if (!totalItems) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end   = Math.min(currentPage * pageSize, totalItems);
  const max   = Math.max(totalPages, 1);

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3 rounded-b-2xl"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Showing <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{start}–{end}</span> of{" "}
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{totalItems}</span> records
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage <= 1}
          className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <i className="fas fa-chevron-left text-xs" /> Prev
        </button>

        <span
          className="px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{
            background: "var(--accent)",
            color: "#fff",
            minWidth: 80,
            textAlign: "center",
          }}
        >
          {currentPage} / {max}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <i className="fas fa-chevron-right text-xs" />
        </button>
      </div>
    </div>
  );
}
