import React from "react";

function DataTable({ columns, data, isLoading, actions }) {
  if (isLoading) {
    return (
      <div
        className="flex justify-center items-center py-16 rounded-2xl"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        boxShadow: "var(--shadow)",
      }}
    >
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <i className="fas fa-inbox text-4xl" style={{ color: "var(--border)" }} />
          <p className="font-semibold text-base" style={{ color: "var(--text-muted)" }}>No data available</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>There's nothing to show here yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="portal-table w-full">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={i}>{col.header}</th>
                ))}
                {(actions !== false) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri}>
                  {columns.map((col, ci) => (
                    <td key={ci}>{row[col.accessor]}</td>
                  ))}
                  {(actions !== false) && (
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:scale-110"
                          style={{ color: "var(--accent)", background: "transparent" }}
                          title="View"
                        >
                          <i className="fas fa-eye text-sm" />
                        </button>
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:scale-110"
                          style={{ color: "#f59e0b", background: "transparent" }}
                          title="Edit"
                        >
                          <i className="fas fa-edit text-sm" />
                        </button>
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:scale-110"
                          style={{ color: "#ef4444", background: "transparent" }}
                          title="Delete"
                        >
                          <i className="fas fa-trash text-sm" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DataTable;
