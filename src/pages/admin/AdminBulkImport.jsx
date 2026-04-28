import React, { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import apiService from "../../services/apiService";
import { formatDateTime } from "../../utils/dateFormat";

const FALLBACK_IMPORT_TYPES = [
  { key: "subjects", label: "Subjects" },
  { key: "classes", label: "Classes" },
  { key: "teachers", label: "Teachers" },
  { key: "students", label: "Students" },
  { key: "parents", label: "Parents / Guardians" },
  { key: "fees", label: "Fees" },
  { key: "attendance", label: "Attendance Seed Data" },
];

// Recommended order — earlier types are referenced by later ones.
const IMPORT_ORDER = ["subjects", "classes", "teachers", "students", "parents", "fees", "attendance"];

const DEPENDENCIES = {
  students: ["classes"],
  parents: ["students"],
  fees: ["students"],
  attendance: ["students"],
};

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

const PERSON_TYPES = new Set(["students", "teachers", "parents"]);

export default function AdminBulkImport() {
  const [step, setStep] = useState(1);
  const [importType, setImportType] = useState("students");
  const [catalog, setCatalog] = useState(null);
  const [selectedParams, setSelectedParams] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [duplicateStrategy, setDuplicateStrategy] = useState("skip");
  const [accountStrategy, setAccountStrategy] = useState("random");
  const [sharedPassword, setSharedPassword] = useState("");
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validation, setValidation] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.getBulkImportCatalog();
        setCatalog(data);
      } catch (e) {
        console.error("Failed to load import catalog", e);
      }
      loadHistory();
    })();
  }, []);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await apiService.getBulkImportHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const importTypes = useMemo(() => {
    if (catalog?.import_types?.length) return catalog.import_types;
    return FALLBACK_IMPORT_TYPES;
  }, [catalog]);

  const fields = useMemo(
    () => catalog?.parameter_library?.[importType] || [],
    [catalog, importType]
  );

  const requiredKeys = useMemo(
    () => fields.filter((f) => f.required).map((f) => f.key),
    [fields]
  );

  const selectedFieldObjects = useMemo(() => {
    const keySet = new Set([...requiredKeys, ...selectedParams]);
    return fields.filter((f) => keySet.has(f.key));
  }, [fields, requiredKeys, selectedParams]);

  const dependencyWarnings = useMemo(() => {
    const deps = DEPENDENCIES[importType] || [];
    if (!deps.length) return [];
    return deps.map(
      (d) => `Make sure your ${d} are already in the system before importing ${importType}.`
    );
  }, [importType]);

  const toggleParam = (key) => {
    if (requiredKeys.includes(key)) return;
    setSelectedParams((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const downloadTemplate = () => {
    const headers = selectedFieldObjects.map((f) => f.key).join(",");
    const sample = selectedFieldObjects
      .map((f) => {
        if (f.type === "date") return "2026-01-15";
        if (f.type === "number") return "0";
        if (f.type === "boolean") return "true";
        return "";
      })
      .join(",");
    const csv = `${headers}\n${sample}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `${importType}_template.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("import_type", importType);
    fd.append("selected_parameters", JSON.stringify(selectedParams));
    fd.append("mapping", JSON.stringify({}));
    fd.append("date_format", dateFormat);
    fd.append("duplicate_strategy", duplicateStrategy);
    if (PERSON_TYPES.has(importType)) {
      fd.append("account_strategy", accountStrategy);
      if (accountStrategy === "shared") {
        fd.append("shared_password", sharedPassword);
      }
    }
    return fd;
  };

  const runValidation = async () => {
    if (!uploadFile) {
      alert("Please choose a file first.");
      return;
    }
    try {
      setValidating(true);
      setValidation(null);
      const data = await apiService.validateBulkImport(buildFormData());
      setValidation(data);
      setStep(4);
    } catch (e) {
      alert(`Validation failed: ${e.message || "unknown error"}`);
    } finally {
      setValidating(false);
    }
  };

  const runCommit = async () => {
    if (!validation) {
      alert("Run validation first.");
      return;
    }
    if (
      !validation.valid &&
      !window.confirm(
        `Validation found ${validation.errors?.length || 0} row(s) with errors. ` +
          `Those rows will be skipped. Continue?`
      )
    ) {
      return;
    }
    if (
      PERSON_TYPES.has(importType) &&
      accountStrategy === "shared" &&
      sharedPassword.length < 8
    ) {
      alert("Shared password must be at least 8 characters.");
      return;
    }
    try {
      setCommitting(true);
      setCommitResult(null);
      const data = await apiService.commitBulkImport(buildFormData());
      setCommitResult(data);
      loadHistory();
    } catch (e) {
      alert(`Import failed: ${e.message || "unknown error"}`);
    } finally {
      setCommitting(false);
    }
  };

  const rollback = async (jobId) => {
    if (
      !window.confirm(
        "Rolling back will delete created records and revert updates from this import. " +
          "Records that were modified after the import (e.g. fees paid, marks added) " +
          "may cause partial failures. Continue?"
      )
    )
      return;
    try {
      const res = await apiService.rollbackBulkImport(jobId);
      alert(res.message || "Rollback finished.");
      loadHistory();
    } catch (e) {
      alert(`Rollback failed: ${e.message || "unknown error"}`);
    }
  };

  const stepTitle = ["Choose Type", "Select Parameters", "Upload File", "Review & Import"][step - 1];
  const isPersonType = PERSON_TYPES.has(importType);

  return (
    <div>
      <Header title="Bulk Import" subtitle="Upload school data from Excel or CSV." />
      <div className="p-6 space-y-6">
        <div className="portal-card p-5 rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Import Wizard
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                className={`text-left p-3 rounded-lg border transition ${step === s ? "bg-blue-600 text-white border-blue-600" : "border-gray-200"}`}
              >
                <p className="text-xs opacity-80">Step {s}</p>
                <p className="text-sm font-semibold">{["Type", "Parameters", "Upload", "Review"][s - 1]}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="portal-card p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
          <p className="font-semibold mb-1">Recommended import order</p>
          <p>{IMPORT_ORDER.join(" → ")}</p>
          <p className="mt-1 text-xs">Each type can reference the ones before it. Importing in this order avoids "not found" errors.</p>
        </div>

        <div className="portal-card p-6 rounded-xl">
          <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{stepTitle}</h2>

          {step === 1 && (
            <div className="space-y-4 mt-4">
              <label className="block text-sm font-medium" style={{ color: "var(--text-muted)" }}>Data Type</label>
              <select
                value={importType}
                onChange={(e) => {
                  setImportType(e.target.value);
                  setSelectedParams([]);
                  setValidation(null);
                  setCommitResult(null);
                }}
                className="w-full md:w-96 p-3 rounded-lg border border-gray-300 bg-white"
              >
                {importTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {dependencyWarnings.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  {dependencyWarnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 mt-4">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Required parameters are auto-selected. Add optional parameters you want this import to support.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fields.map((f) => {
                  const checked = requiredKeys.includes(f.key) || selectedParams.includes(f.key);
                  return (
                    <label key={f.key} className="border rounded-lg p-3 flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={requiredKeys.includes(f.key)}
                        onChange={() => toggleParam(f.key)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{f.label || f.key}</span>
                        <span className="block text-xs text-gray-500">{f.key} • {f.type}{f.required ? " • required" : ""}</span>
                      </span>
                    </label>
                  );
                })}
                {fields.length === 0 && <p className="text-sm text-gray-500">No parameters defined for this type.</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 mt-4">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { setUploadFile(e.target.files?.[0] || null); setValidation(null); setCommitResult(null); }}
                className="block w-full md:w-[440px] text-sm border rounded-lg p-2"
              />
              {uploadFile && (
                <p className="text-sm text-gray-600">
                  Selected: <span className="font-semibold">{uploadFile.name}</span> ({Math.round(uploadFile.size / 1024)} KB)
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium">Date Format</span>
                  <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className="mt-1 w-full p-3 rounded-lg border">
                    {DATE_FORMATS.map((fmt) => <option key={fmt} value={fmt}>{fmt}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Duplicate Handling</span>
                  <select value={duplicateStrategy} onChange={(e) => setDuplicateStrategy(e.target.value)} className="mt-1 w-full p-3 rounded-lg border">
                    <option value="skip">Skip duplicates</option>
                    <option value="update">Update existing</option>
                    <option value="error">Block import on duplicates</option>
                  </select>
                </label>
              </div>

              {isPersonType && (
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
                  <p className="text-sm font-semibold text-blue-900">User Account Strategy</p>
                  <p className="text-xs text-blue-800">
                    {importType} need login accounts. Choose how passwords are set.
                  </p>
                  <select
                    value={accountStrategy}
                    onChange={(e) => setAccountStrategy(e.target.value)}
                    className="w-full p-2 rounded-lg border bg-white"
                  >
                    <option value="random">Generate random temp password (admin must distribute)</option>
                    <option value="shared">Use one shared password for all imported users</option>
                    <option value="inactive">Create with no password — users must use "Forgot password"</option>
                  </select>
                  {accountStrategy === "shared" && (
                    <input
                      type="text"
                      placeholder="Shared password (min 8 chars)"
                      value={sharedPassword}
                      onChange={(e) => setSharedPassword(e.target.value)}
                      className="w-full p-2 rounded-lg border"
                    />
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={runValidation}
                disabled={!uploadFile || validating}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                {validating ? "Validating..." : "Validate File"}
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 mt-4">
              <div className="p-4 rounded-lg border bg-gray-50">
                <p className="text-sm"><strong>Type:</strong> {importTypes.find((t) => t.key === importType)?.label}</p>
                <p className="text-sm"><strong>File:</strong> {uploadFile?.name || "No file selected"}</p>
                <p className="text-sm"><strong>Date format:</strong> {dateFormat}</p>
                <p className="text-sm"><strong>Duplicates:</strong> {duplicateStrategy}</p>
                {isPersonType && <p className="text-sm"><strong>Account strategy:</strong> {accountStrategy}</p>}
              </div>

              {validation && (
                <div className={`p-4 rounded-lg border ${validation.valid ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
                  <p className="text-sm font-semibold">
                    {validation.valid ? "✓ All rows valid" : `⚠ ${validation.errors?.length || 0} row(s) with errors`}
                  </p>
                  <p className="text-sm">Total rows: {validation.total_rows}</p>
                  {validation.errors?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">Show row errors</summary>
                      <div className="mt-2 max-h-48 overflow-y-auto text-xs space-y-1">
                        {validation.errors.slice(0, 50).map((err, i) => (
                          <div key={i} className="p-1 bg-white rounded">
                            Row {err.row}: {(err.errors || []).join("; ")}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {commitResult && (
                <div className="p-4 rounded-lg border border-emerald-300 bg-emerald-50 text-sm">
                  <p className="font-semibold">{commitResult.message}</p>
                  <p>Created: {commitResult.created} • Updated: {commitResult.updated || 0} • Errors: {commitResult.errors?.length || 0}</p>
                  {commitResult.errors?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer">Show errors</summary>
                      <div className="mt-2 max-h-48 overflow-y-auto text-xs space-y-1">
                        {commitResult.errors.slice(0, 50).map((err, i) => (
                          <div key={i} className="p-1 bg-white rounded">Row {err.row}: {err.error}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={runCommit}
                disabled={!validation || committing}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
              >
                {committing ? "Importing..." : "Confirm & Import"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-6">
            <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} className="px-4 py-2 rounded-lg border border-gray-300">Back</button>
            <button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Next</button>
            <button type="button" onClick={downloadTemplate} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">Download Template</button>
          </div>
        </div>

        <div className="portal-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Import History</h3>
            <button onClick={loadHistory} className="text-sm text-blue-600 hover:underline">
              {historyLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No imports yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-2">When</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">File</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Created</th>
                    <th className="p-2">Updated</th>
                    <th className="p-2">Errors</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="p-2 text-xs">{formatDateTime(j.created_at)}</td>
                      <td className="p-2">{j.import_type}</td>
                      <td className="p-2 text-xs truncate max-w-[180px]">{j.file_name}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          j.status === "completed" ? "bg-green-100 text-green-700" :
                          j.status === "rolled_back" ? "bg-gray-200 text-gray-700" :
                          j.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                        }`}>{j.status}</span>
                      </td>
                      <td className="p-2">{j.created_count}</td>
                      <td className="p-2">{j.updated_count}</td>
                      <td className="p-2">{j.error_count}</td>
                      <td className="p-2">
                        {j.status === "completed" && (
                          <button
                            onClick={() => rollback(j.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Roll back
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
