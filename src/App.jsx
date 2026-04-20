import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEYS = {
  session: "lab_portal_session",
  results: "lab_portal_results",
  samples: "lab_portal_samples",
  alerts: "lab_portal_alerts",
  audit: "lab_portal_audit",
};

const DEPARTMENT_OPTIONS = [
  "Emergency",
  "ICU",
  "Ward",
  "OPD",
  "NICU",
  "PICU",
  "OR",
  "Labor Room",
  "Dialysis",
  "Other",
];

const TEST_OPTIONS = ["CBC", "Potassium"];
const RESULT_STATUS_OPTIONS = ["Normal", "Review", "Critical", "Cancelled"];
const SAMPLE_STATUS_OPTIONS = ["Received", "Partial Completed", "Completed", "Cancelled"];

const HOSPITAL_NAME = "King Salman Armed Forces Hospital";
const SYSTEM_NAME = "Zero Downtime Lab Portal";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeRead(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function now() {
  return new Date().toISOString();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function generateBarcodeSVG(text) {
  const value = String(text || "").toUpperCase();
  const bars = value
    .split("")
    .map((char, index) => {
      const code = char.charCodeAt(0);
      const width = 2 + (code % 4);
      const x = index * 6 + 10;
      return `<rect x="${x}" y="8" width="${width}" height="48" fill="#111" />`;
    })
    .join("");

  const width = Math.max(220, value.length * 8 + 20);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="88" viewBox="0 0 ${width} 88">
      <rect x="0" y="0" width="${width}" height="88" fill="#fff"/>
      ${bars}
      <text x="${width / 2}" y="78" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" fill="#111">
        ${escapeHtml(value)}
      </text>
    </svg>
  `;
}

function parseStoredDateTime(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getTurnaroundMinutes(sample, result) {
  if (!sample || !result) return null;
  const sampleDate = parseStoredDateTime(sample.createdAt) || parseStoredDateTime(sample.time);
  const resultDate = parseStoredDateTime(result.createdAt) || parseStoredDateTime(result.time);
  if (!sampleDate || !resultDate) return null;
  const diffMs = resultDate.getTime() - sampleDate.getTime();
  if (diffMs < 0) return null;
  return Math.round(diffMs / 60000);
}

function formatTurnaround(min) {
  if (min == null) return "-";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function tatStyle(minutes) {
  if (minutes == null) return {};
  if (minutes > 60) return { color: "#b91c1c", fontWeight: "bold" };
  if (minutes > 30) return { color: "#b45309", fontWeight: "bold" };
  return { color: "#166534", fontWeight: "bold" };
}

function getStatus(test, value) {
  const v = parseFloat(value);
  if (test === "Potassium" && !Number.isNaN(v)) {
    if (v >= 6) return "Critical";
    if (v >= 5.3) return "Review";
    return "Normal";
  }
  return "Normal";
}

function sampleStatusStyle(status) {
  if (status === "Received") return { background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" };
  if (status === "Partial Completed") return { background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe" };
  if (status === "Completed") return { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
  return { background: "#e2e8f0", color: "#334155", border: "1px solid #cbd5e1" };
}

function badgeStyle(status) {
  if (status === "Critical") return { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" };
  if (status === "Review") return { background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" };
  if (status === "Cancelled") return { background: "#e2e8f0", color: "#334155", border: "1px solid #cbd5e1" };
  return { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
}

function syncBadgeStyle(value) {
  return value
    ? { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" }
    : { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" };
}

export default function App() {
  const [session, setSession] = useState(() => safeRead(STORAGE_KEYS.session, null));
  const [results, setResults] = useState(() => safeRead(STORAGE_KEYS.results, []));
  const [samples, setSamples] = useState(() => safeRead(STORAGE_KEYS.samples, []));
  const [alerts, setAlerts] = useState(() => safeRead(STORAGE_KEYS.alerts, []));
  const [audit, setAudit] = useState(() => safeRead(STORAGE_KEYS.audit, []));
  const [filters, setFilters] = useState({
    department: "",
    test: "",
    resultStatus: "",
    syncStatus: "",
    alertStatus: "",
    sampleStatus: "",
  });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [sampleForm, setSampleForm] = useState({
    barcode: "",
    mrn: "",
    patient: "",
    department: "",
    tests: ["CBC"],
    receivedBy: "",
    time: "",
  });
  const [manualForm, setManualForm] = useState({
    sampleId: "",
    barcode: "",
    mrn: "",
    patient: "",
    department: "",
    test: "CBC",
    result: "",
    technician: "",
    comment: "",
    time: "",
  });
  const [searchMrn, setSearchMrn] = useState("");
  const [editingResultId, setEditingResultId] = useState(null);
  const [editForm, setEditForm] = useState({ result: "", comment: "" });
  const importInputRef = useRef(null);
  const audioRef = useRef(null);

  const fixedUsers = {
    admin: { username: "admin", password: "1234", role: "Admin", name: "System Administrator" },
    doctor: { username: "doctor", password: "1234", role: "Doctor", name: "Duty Doctor" },
    lab: { username: "lab", password: "1234", role: "Lab", name: "Laboratory Staff" },
    reception: { username: "reception", password: "1234", role: "Reception", name: "Reception Staff" },
  };

  const canReceiveSamples = session?.role === "Reception" || session?.role === "Admin";
  const canEnterResults = session?.role === "Lab" || session?.role === "Admin";
  const canManageResults = session?.role === "Lab" || session?.role === "Admin";
  const canViewResultsPanel = session?.role === "Doctor" || session?.role === "Lab" || session?.role === "Admin";

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.results, JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.samples, JSON.stringify(samples));
  }, [samples]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify(audit));
  }, [audit]);

  function addAudit(action, details) {
    const row = {
      id: createId(),
      action,
      details,
      actor: session?.name || "System",
      role: session?.role || "-",
      createdAt: now(),
    };
    setAudit((prev) => [row, ...prev].slice(0, 200));
  }

  function handleLogin(e) {
    e.preventDefault();
    const username = loginForm.username.trim().toLowerCase();
    const password = loginForm.password;
    const user = fixedUsers[username];

    if (!user || user.password !== password) {
      setLoginError("Invalid username or password");
      return;
    }

    setSession(user);
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(user));
    setLoginError("");
    if (user.role === "Reception") {
      setSampleForm((prev) => ({ ...prev, receivedBy: user.name }));
    }
    if (user.role === "Lab") {
      setManualForm((prev) => ({ ...prev, technician: user.name }));
    }
  }

  function handleLogout() {
    setSession(null);
    localStorage.removeItem(STORAGE_KEYS.session);
    setLoginForm({ username: "", password: "" });
  }

  function computeStatusForSample(sample, allResults) {
    if (sample.cancelled) return "Cancelled";
    const linked = allResults.filter((r) => !r.cancelled && r.sampleId === sample.id);
    const completedTests = linked.map((r) => r.test);
    const total = sample.tests.length;
    if (completedTests.length === 0) return "Received";
    if (completedTests.length < total) return "Partial Completed";
    return "Completed";
  }

  function refreshSamplesStatus(nextResults) {
    setSamples((prev) =>
      prev.map((sample) => ({
        ...sample,
        status: computeStatusForSample(sample, nextResults),
      }))
    );
  }

  function sampleExists(candidate) {
    return samples.some((s) => {
      if (s.cancelled) return false;
      const sameBarcode = s.barcode.trim().toLowerCase() === candidate.barcode.trim().toLowerCase();
      const sameMrnAndPatient =
        s.mrn.trim().toLowerCase() === candidate.mrn.trim().toLowerCase() &&
        s.patient.trim().toLowerCase() === candidate.patient.trim().toLowerCase();
      return sameBarcode || sameMrnAndPatient;
    });
  }

  function resultExists(candidate) {
    return results.some((r) => {
      if (r.cancelled) return false;
      const sameSampleAndTest =
        r.sampleId && candidate.sampleId && r.sampleId === candidate.sampleId && r.test === candidate.test;
      const sameBarcodeMrnTest =
        r.barcode === candidate.barcode && r.mrn === candidate.mrn && r.test === candidate.test;
      return sameSampleAndTest || sameBarcodeMrnTest;
    });
  }

  function triggerCritical(result) {
    if (alerts.find((a) => a.resultId === result.id)) return;
    const newAlert = {
      id: createId(),
      resultId: result.id,
      mrn: result.mrn,
      patient: result.patient,
      seen: false,
      createdAt: now(),
    };
    setAlerts((prev) => [newAlert, ...prev]);
    if (audioRef.current) audioRef.current.play().catch(() => {});
  }

  function toggleSampleTest(test) {
    setSampleForm((prev) => {
      const exists = prev.tests.includes(test);
      const next = exists ? prev.tests.filter((t) => t !== test) : [...prev.tests, test];
      return { ...prev, tests: next.length ? next : [test] };
    });
  }

  function handleAddSample(e) {
    e.preventDefault();
    if (!canReceiveSamples) return;
    if (!sampleForm.barcode || !sampleForm.mrn || !sampleForm.patient || !sampleForm.department || !sampleForm.receivedBy) {
      alert("Please fill all required fields");
      return;
    }

    const newSample = {
      id: createId(),
      barcode: sampleForm.barcode.trim(),
      mrn: sampleForm.mrn.trim(),
      patient: sampleForm.patient.trim(),
      department: sampleForm.department,
      tests: sampleForm.tests,
      receivedBy: sampleForm.receivedBy.trim(),
      status: "Received",
      cancelled: false,
      createdAt: sampleForm.time || now(),
      time: sampleForm.time || now(),
    };

    if (sampleExists(newSample)) {
      alert("Duplicate sample detected");
      return;
    }

    setSamples((prev) => [newSample, ...prev]);
    addAudit("Sample Received", `Barcode ${newSample.barcode} | MRN ${newSample.mrn} | Tests: ${newSample.tests.join(", ")}`);
    setSampleForm({
      barcode: "",
      mrn: "",
      patient: "",
      department: "",
      tests: ["CBC"],
      receivedBy: session?.name || "",
      time: "",
    });
  }

  function loadSampleToManual(sample) {
    const existingTests = results.filter((r) => !r.cancelled && r.sampleId === sample.id).map((r) => r.test);
    const remaining = sample.tests.filter((t) => !existingTests.includes(t));
    const selectedTest = remaining[0] || sample.tests[0];
    setManualForm({
      sampleId: sample.id,
      barcode: sample.barcode,
      mrn: sample.mrn,
      patient: sample.patient,
      department: sample.department,
      test: selectedTest,
      result: "",
      technician: session?.name || "",
      comment: "",
      time: "",
    });
  }

  function cancelSample(sampleId) {
    const ok = window.confirm("Cancel this sample?");
    if (!ok) return;
    setSamples((prev) => prev.map((s) => (s.id === sampleId ? { ...s, cancelled: true, status: "Cancelled" } : s)));
    const sample = samples.find((s) => s.id === sampleId);
    if (sample) addAudit("Sample Cancelled", `Barcode ${sample.barcode} | MRN ${sample.mrn}`);
  }

  function handleSaveResult(e) {
    e.preventDefault();
    if (!canEnterResults) return;
    if (!manualForm.barcode || !manualForm.mrn || !manualForm.patient || !manualForm.department || !manualForm.test || !manualForm.result || !manualForm.technician) {
      alert("Please fill all required fields");
      return;
    }

    const status = getStatus(manualForm.test, manualForm.result);
    const newResult = {
      id: createId(),
      sampleId: manualForm.sampleId || "",
      barcode: manualForm.barcode.trim(),
      mrn: manualForm.mrn.trim(),
      patient: manualForm.patient.trim(),
      department: manualForm.department,
      test: manualForm.test,
      result: manualForm.result.trim(),
      status,
      technician: manualForm.technician.trim(),
      comment: manualForm.comment.trim(),
      synced: false,
      cancelled: false,
      createdAt: manualForm.time || now(),
      time: manualForm.time || now(),
      note: "Issued during LIS downtime",
      source: "Manual Entry",
    };

    if (resultExists(newResult)) {
      alert("Duplicate result detected for this sample/test");
      return;
    }

    const nextResults = [newResult, ...results];
    setResults(nextResults);
    refreshSamplesStatus(nextResults);
    if (status === "Critical") triggerCritical(newResult);
    addAudit("Result Saved", `MRN ${newResult.mrn} | ${newResult.test} | ${newResult.status}`);
    setManualForm({
      sampleId: "",
      barcode: "",
      mrn: "",
      patient: "",
      department: "",
      test: "CBC",
      result: "",
      technician: session?.name || "",
      comment: "",
      time: "",
    });
  }

  function markSynced(resultId) {
    setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, synced: true, note: "Marked for LIS reconciliation" } : r)));
    const row = results.find((r) => r.id === resultId);
    if (row) addAudit("Marked Synced", `MRN ${row.mrn} | ${row.test}`);
  }

  function beginEditResult(item) {
    setEditingResultId(item.id);
    setEditForm({ result: item.result, comment: item.comment || "" });
  }

  function saveEditResult() {
    if (!editingResultId) return;
    const target = results.find((r) => r.id === editingResultId);
    if (!target) return;
    if (!editForm.result.trim()) {
      alert("Result cannot be empty");
      return;
    }

    const updatedResultStatus = target.test === "CBC" ? target.status : getStatus(target.test, editForm.result.trim());
    const nextResults = results.map((r) =>
      r.id === editingResultId
        ? { ...r, result: editForm.result.trim(), comment: editForm.comment.trim(), status: updatedResultStatus, editedAt: now(), editedBy: session?.name || "" }
        : r
    );
    setResults(nextResults);
    if (updatedResultStatus === "Critical" && target.status !== "Critical") {
      const updatedItem = nextResults.find((r) => r.id === editingResultId);
      if (updatedItem) triggerCritical(updatedItem);
    }
    addAudit("Result Edited", `MRN ${target.mrn} | ${target.test}`);
    setEditingResultId(null);
  }

  function cancelResult(item) {
    const ok = window.confirm("Cancel this result?");
    if (!ok) return;
    const nextResults = results.map((r) =>
      r.id === item.id
        ? { ...r, cancelled: true, status: "Cancelled", cancelledAt: now(), cancelledBy: session?.name || "", synced: false, note: "Result cancelled" }
        : r
    );
    setResults(nextResults);
    refreshSamplesStatus(nextResults);
    addAudit("Result Cancelled", `MRN ${item.mrn} | ${item.test}`);
  }

  function handleExportCSV() {
    if (!results.length) {
      alert("No results available to export");
      return;
    }
    const headers = ["id", "sampleId", "barcode", "mrn", "patient", "department", "test", "result", "status", "synced", "comment", "technician", "createdAt", "note", "source"];
    const rows = results.map((item) =>
      [item.id, item.sampleId, item.barcode, item.mrn, item.patient, item.department, item.test, item.result, item.status, item.synced ? "Yes" : "No", item.comment, item.technician, item.createdAt, item.note, item.source]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lab_results_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function openImportDialog() {
    importInputRef.current?.click();
  }

  function handleImportCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "").trim();
        if (!text) {
          alert("CSV file is empty");
          return;
        }
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) {
          alert("No rows found in CSV");
          return;
        }
        const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
        const importedRows = lines.slice(1).map((line) => {
          const cols = parseCSVLine(line);
          const row = {};
          headers.forEach((header, index) => {
            row[header] = cols[index] ?? "";
          });
          return {
            id: row.id || createId(),
            sampleId: row.sampleid || "",
            barcode: row.barcode || "",
            mrn: row.mrn || "",
            patient: row.patient || "",
            department: row.department || "",
            test: row.test || "CBC",
            result: row.result || "",
            status: row.status || "Normal",
            synced: String(row.synced || "").toLowerCase() === "yes",
            comment: row.comment || "",
            technician: row.technician || "",
            createdAt: row.createdat || now(),
            time: row.createdat || now(),
            note: row.note || "Imported from CSV",
            source: row.source || "Imported CSV",
            cancelled: String(row.cancelled || "").toLowerCase() === "yes",
          };
        });
        const replace = window.confirm("Press OK to replace existing results, or Cancel to append.");
        if (replace) {
          setResults(importedRows);
          refreshSamplesStatus(importedRows);
        } else {
          const next = [...importedRows, ...results];
          setResults(next);
          refreshSamplesStatus(next);
        }
        addAudit("CSV Imported", `${importedRows.length} result(s) imported`);
      } catch {
        alert("Failed to import CSV");
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetAllSavedData() {
    const ok = window.confirm("This will clear all saved data from this browser. Continue?");
    if (!ok) return;
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    setResults([]);
    setSamples([]);
    setAlerts([]);
    setAudit([]);
    setFilters({ department: "", test: "", resultStatus: "", syncStatus: "", alertStatus: "", sampleStatus: "" });
    setSearchMrn("");
    setEditingResultId(null);
  }

  const pendingAlerts = useMemo(() => alerts.filter((a) => !a.seen), [alerts]);

  const visibleResults = useMemo(() => {
    let rows = [...results];
    if (session?.role === "Doctor") {
      if (!searchMrn.trim()) return [];
      rows = rows.filter((r) => r.mrn.toLowerCase().includes(searchMrn.trim().toLowerCase()));
    }
    if (filters.department) rows = rows.filter((r) => r.department === filters.department);
    if (filters.test) rows = rows.filter((r) => r.test === filters.test);
    if (filters.resultStatus) rows = rows.filter((r) => r.status === filters.resultStatus);
    if (filters.syncStatus) rows = rows.filter((r) => (filters.syncStatus === "Synced" ? r.synced : !r.synced));
    if (filters.alertStatus) {
      rows = rows.filter((r) => {
        const alert = alerts.find((a) => a.resultId === r.id);
        const value = alert ? (alert.seen ? "Acknowledged" : "Pending") : "None";
        return value === filters.alertStatus;
      });
    }
    return rows.map((r) => {
      const sample = samples.find((s) => s.id === r.sampleId) || samples.find((s) => s.barcode === r.barcode);
      const tatMinutes = getTurnaroundMinutes(sample, r);
      const alert = alerts.find((a) => a.resultId === r.id);
      return {
        ...r,
        tatMinutes,
        tatLabel: formatTurnaround(tatMinutes),
        alertStatus: alert ? (alert.seen ? "Acknowledged" : "Pending") : "None",
        alertObj: alert || null,
      };
    });
  }, [results, session, searchMrn, filters, alerts, samples]);

  const visibleSamples = useMemo(() => {
    let rows = [...samples];
    if (filters.department) rows = rows.filter((s) => s.department === filters.department);
    if (filters.sampleStatus) rows = rows.filter((s) => s.status === filters.sampleStatus);
    if (filters.test) rows = rows.filter((s) => s.tests.includes(filters.test));
    return rows;
  }, [samples, filters]);

  const criticalCount = results.filter((r) => r.status === "Critical" && !r.cancelled).length;
  const pendingSyncCount = results.filter((r) => !r.synced && !r.cancelled).length;
  const completedSamplesCount = samples.filter((s) => s.status === "Completed").length;
  const activeSamplesCount = samples.filter((s) => s.status !== "Completed" && s.status !== "Cancelled").length;

  const avgTat = useMemo(() => {
    const values = results
      .filter((r) => !r.cancelled)
      .map((r) => {
        const sample = samples.find((s) => s.id === r.sampleId) || samples.find((s) => s.barcode === r.barcode);
        return getTurnaroundMinutes(sample, r);
      })
      .filter((v) => v != null);
    if (!values.length) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [results, samples]);

  const maxTat = useMemo(() => {
    const values = results
      .filter((r) => !r.cancelled)
      .map((r) => {
        const sample = samples.find((s) => s.id === r.sampleId) || samples.find((s) => s.barcode === r.barcode);
        return getTurnaroundMinutes(sample, r);
      })
      .filter((v) => v != null);
    return values.length ? Math.max(...values) : null;
  }, [results, samples]);

  const completionRate = samples.length ? Math.round((completedSamplesCount / samples.length) * 100) : 0;

  function markAlertSeen(alertId) {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, seen: true, seenAt: now() } : a)));
    const row = alerts.find((a) => a.id === alertId);
    if (row) addAudit("Critical Alert Acknowledged", `MRN ${row.mrn}`);
  }

  if (!session) {
    return (
      <div style={loginPageStyle}>
        <div style={loginCardStyle}>
          <div style={loginHeaderStyle}>
            <div style={{ flex: 1 }}>
              <div style={loginHospitalNameStyle}>{HOSPITAL_NAME}</div>
              <h1 style={loginTitleStyle}>{SYSTEM_NAME}</h1>
              <p style={loginSubtitleStyle}>Prototype access for downtime result handling during LIS maintenance.</p>
            </div>
          </div>
          <div style={demoBoxStyle}>
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>Prototype Demo Accounts</div>
            <div>Admin: <strong>admin</strong> / 1234</div>
            <div>Doctor: <strong>doctor</strong> / 1234</div>
            <div>Lab: <strong>lab</strong> / 1234</div>
            <div>Reception: <strong>reception</strong> / 1234</div>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label>Username</label>
              <input value={loginForm.username} onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))} style={inputStyle} placeholder="admin, doctor, or lab" />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label>Password</label>
              <input type="password" value={loginForm.password} onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))} style={inputStyle} placeholder="Enter password" />
            </div>
            {loginError && <div style={errorBoxStyle}>{loginError}</div>}
            <button type="submit" style={buttonStyle}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <audio ref={audioRef}>
        <source src="data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTAAAAAA////AAAA////AAAA////AAAA" type="audio/wav" />
      </audio>
      <div style={{ maxWidth: "1550px", margin: "0 auto" }}>
        {session.role === "Doctor" && pendingAlerts.length > 0 && (
          <div style={criticalAlertOverlayStyle}>
            <div style={criticalAlertBoxStyle}>
              <div style={criticalAlertHeaderStyle}>
                <div>
                  <div style={criticalAlertTitleStyle}>Critical Results Alerts</div>
                  <div style={{ color: "#475569", marginTop: 4 }}>Please review and acknowledge the following critical results.</div>
                </div>
                <div style={criticalAlertCounterStyle}>{pendingAlerts.length} alert{pendingAlerts.length > 1 ? "s" : ""}</div>
              </div>
              <div style={criticalAlertListStyle}>
                {pendingAlerts.map((alertItem) => (
                  <div key={alertItem.id} style={criticalAlertItemStyle}>
                    <div style={criticalAlertItemTopStyle}>
                      <div style={{ fontWeight: "bold", color: "#7f1d1d", fontSize: 18 }}>نتيجة حرجة للمريض رقم {alertItem.mrn}</div>
                      <button type="button" style={smallButtonOrange} onClick={() => markAlertSeen(alertItem.id)}>تم الاطلاع</button>
                    </div>
                    <div style={criticalAlertDetailsStyle}>
                      <div><strong>MRN:</strong> {alertItem.mrn}</div>
                      <div><strong>Patient:</strong> {alertItem.patient || "-"}</div>
                      <div><strong>Time:</strong> {alertItem.createdAt || "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={topBannerStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
            <div>
              <div style={topHospitalNameStyle}>{HOSPITAL_NAME}</div>
              <h1 style={topSystemNameStyle}>{SYSTEM_NAME}</h1>
              <div style={topSubTextStyle}>Prototype workflow for temporary reporting during LIS downtime</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
              <div style={statusPillStyle}>LIS Status: Scheduled Maintenance Window</div>
              <div style={loggedUserStyle}>Logged in as <strong>{session.name}</strong> ({session.role})</div>
            </div>
          </div>
          <div style={headerButtonsRowStyle}>
            <button type="button" onClick={handleExportCSV} style={smallButtonGreen}>Export CSV</button>
            <button type="button" onClick={openImportDialog} style={smallButtonPurple}>Import CSV</button>
            <button type="button" onClick={resetAllSavedData} style={smallButtonOrange}>Reset Saved Data</button>
            <button type="button" onClick={handleLogout} style={smallButtonGray}>Logout</button>
            <input ref={importInputRef} type="file" accept=".csv" onChange={handleImportCSV} style={{ display: "none" }} />
          </div>
        </div>

        <div style={{ ...panelStyle, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>{session.role === "Admin" ? "Admin Dashboard" : "Filters & Overview"}</h2>
              <p style={{ color: "#64748b", margin: 0 }}>Quick monitoring cards and advanced filters.</p>
            </div>
            {session.role === "Doctor" ? (
              <input value={searchMrn} onChange={(e) => setSearchMrn(e.target.value)} style={{ ...inputStyle, width: 300, marginBottom: 0 }} placeholder="Search by patient MRN only..." />
            ) : (
              <input value={searchMrn} onChange={(e) => setSearchMrn(e.target.value)} style={{ ...inputStyle, width: 300, marginBottom: 0 }} placeholder="Optional MRN search..." />
            )}
          </div>

          <div style={dashboardGridStyle}>
            <div style={cardStyle}><div style={metricLabelStyle}>Total Samples</div><div style={metricValueStyle}>{samples.length}</div></div>
            <div style={cardStyle}><div style={metricLabelStyle}>Active Samples</div><div style={metricValueStyle}>{activeSamplesCount}</div></div>
            <div style={cardStyle}><div style={metricLabelStyle}>Completed Samples</div><div style={metricValueStyle}>{completedSamplesCount}</div></div>
            <div style={{ ...cardStyle, background: "#fef2f2", border: "1px solid #fecaca" }}><div style={{ ...metricLabelStyle, color: "#b91c1c" }}>Critical Results</div><div style={{ ...metricValueStyle, color: "#b91c1c" }}>{criticalCount}</div></div>
            <div style={{ ...cardStyle, background: "#eff6ff", border: "1px solid #bfdbfe" }}><div style={{ ...metricLabelStyle, color: "#1d4ed8" }}>Pending Reconciliation</div><div style={{ ...metricValueStyle, color: "#1d4ed8" }}>{pendingSyncCount}</div></div>
            <div style={{ ...cardStyle, background: "#fff7ed", border: "1px solid #fed7aa" }}><div style={{ ...metricLabelStyle, color: "#c2410c" }}>Pending Doctor Alerts</div><div style={{ ...metricValueStyle, color: "#c2410c" }}>{pendingAlerts.length}</div></div>
            <div style={{ ...cardStyle, background: "#ecfeff", border: "1px solid #a5f3fc" }}><div style={{ ...metricLabelStyle, color: "#0f766e" }}>Average TAT</div><div style={{ ...metricValueStyle, color: "#0f766e" }}>{formatTurnaround(avgTat)}</div></div>
            <div style={{ ...cardStyle, background: "#fdf4ff", border: "1px solid #f5d0fe" }}><div style={{ ...metricLabelStyle, color: "#a21caf" }}>Max TAT</div><div style={{ ...metricValueStyle, color: "#a21caf" }}>{formatTurnaround(maxTat)}</div></div>
            <div style={{ ...cardStyle, background: "#f0fdf4", border: "1px solid #bbf7d0" }}><div style={{ ...metricLabelStyle, color: "#166534" }}>Sample Completion Rate</div><div style={{ ...metricValueStyle, color: "#166534" }}>{completionRate}%</div></div>
          </div>

          <div style={filtersGridStyle}>
            <div>
              <label>Department</label>
              <select value={filters.department} onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))} style={inputStyle}>
                <option value="">All</option>
                {DEPARTMENT_OPTIONS.map((department) => (<option key={department} value={department}>{department}</option>))}
              </select>
            </div>
            <div>
              <label>Test</label>
              <select value={filters.test} onChange={(e) => setFilters((prev) => ({ ...prev, test: e.target.value }))} style={inputStyle}>
                <option value="">All</option>
                {TEST_OPTIONS.map((test) => (<option key={test} value={test}>{test}</option>))}
              </select>
            </div>
            <div>
              <label>Result Status</label>
              <select value={filters.resultStatus} onChange={(e) => setFilters((prev) => ({ ...prev, resultStatus: e.target.value }))} style={inputStyle}>
                <option value="">All</option>
                {RESULT_STATUS_OPTIONS.map((status) => (<option key={status} value={status}>{status}</option>))}
              </select>
            </div>
            <div>
              <label>Sync</label>
              <select value={filters.syncStatus} onChange={(e) => setFilters((prev) => ({ ...prev, syncStatus: e.target.value }))} style={inputStyle}>
                <option value="">All</option>
                <option value="Synced">Synced</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div>
              <label>Alert Status</label>
              <select value={filters.alertStatus} onChange={(e) => setFilters((prev) => ({ ...prev, alertStatus: e.target.value }))} style={inputStyle}>
                <option value="">All</option>
                <option value="Pending">Pending</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="None">None</option>
              </select>
            </div>
            <div>
              <label>Sample Status</label>
              <select value={filters.sampleStatus} onChange={(e) => setFilters((prev) => ({ ...prev, sampleStatus: e.target.value }))} style={inputStyle}>
                <option value="">All</option>
                {SAMPLE_STATUS_OPTIONS.map((status) => (<option key={status} value={status}>{status}</option>))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: canEnterResults || session.role === "Admin" ? "1.15fr 1.85fr" : "1fr", gap: "24px" }}>
          {(canReceiveSamples || session.role === "Admin") && (
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>{canReceiveSamples ? "Sample Reception Entry" : "Samples Overview"}</h2>
              <p style={{ color: "#64748b" }}>Register patient demographics, requested tests, print barcode labels, and track sample status.</p>

              {canReceiveSamples && (
                <form onSubmit={handleAddSample}>
                  <div style={{ marginBottom: 12 }}><label>Barcode</label><input value={sampleForm.barcode} onChange={(e) => setSampleForm((prev) => ({ ...prev, barcode: e.target.value }))} style={inputStyle} placeholder="Scan barcode" /></div>
                  <div style={{ marginBottom: 12 }}><label>MRN</label><input value={sampleForm.mrn} onChange={(e) => setSampleForm((prev) => ({ ...prev, mrn: e.target.value }))} style={inputStyle} placeholder="Patient MRN" /></div>
                  <div style={{ marginBottom: 12 }}>
                    <label>Department</label>
                    <select value={sampleForm.department} onChange={(e) => setSampleForm((prev) => ({ ...prev, department: e.target.value }))} style={inputStyle}>
                      <option value="">Select department</option>
                      {DEPARTMENT_OPTIONS.map((department) => (<option key={department} value={department}>{department}</option>))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}><label>Patient Name</label><input value={sampleForm.patient} onChange={(e) => setSampleForm((prev) => ({ ...prev, patient: e.target.value }))} style={inputStyle} placeholder="Patient name" /></div>
                  <div style={{ marginBottom: 12 }}>
                    <label>Requested Tests</label>
                    <div style={checkboxGridStyle}>
                      {TEST_OPTIONS.map((test) => (
                        <label key={test} style={checkboxItemStyle}>
                          <input type="checkbox" checked={sampleForm.tests.includes(test)} onChange={() => toggleSampleTest(test)} />
                          <span>{test}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}><label>Received Time (Optional)</label><input value={sampleForm.time} onChange={(e) => setSampleForm((prev) => ({ ...prev, time: e.target.value }))} style={inputStyle} placeholder="2026-04-21 10:30" /></div>
                  <div style={{ marginBottom: 16 }}><label>Received By</label><input value={sampleForm.receivedBy} onChange={(e) => setSampleForm((prev) => ({ ...prev, receivedBy: e.target.value }))} style={inputStyle} placeholder="Reception staff name" /></div>
                  <button type="submit" style={buttonStyle}>Save Sample Request</button>
                </form>
              )}

              <div style={{ marginTop: 24 }}>
                <h3 style={{ marginBottom: 12 }}>Samples</h3>
                {visibleSamples.length === 0 ? (
                  <div style={infoBoxStyle}>No samples found.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={thStyle}>Barcode</th>
                          <th style={thStyle}>MRN</th>
                          <th style={thStyle}>Department</th>
                          <th style={thStyle}>Patient</th>
                          <th style={thStyle}>Tests</th>
                          <th style={thStyle}>Status</th>
                          <th style={thStyle}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSamples.map((sample) => {
                          const linkedResults = results.filter((r) => !r.cancelled && r.sampleId === sample.id);
                          const completedTests = linkedResults.map((r) => r.test);
                          const remainingTests = sample.tests.filter((t) => !completedTests.includes(t));
                          return (
                            <tr key={sample.id}>
                              <td style={tdStyle}>{sample.barcode}</td>
                              <td style={tdStyle}>{sample.mrn}</td>
                              <td style={tdStyle}>{sample.department || "-"}</td>
                              <td style={tdStyle}>{sample.patient}</td>
                              <td style={tdStyle}><div>{sample.tests.join(", ")}</div>{remainingTests.length > 0 && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Remaining: {remainingTests.join(", ")}</div>}</td>
                              <td style={tdStyle}><span style={{ ...sampleStatusStyle(sample.status), borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>{sample.status}</span></td>
                              <td style={tdStyle}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button type="button" style={smallButtonBlue} onClick={() => printSampleBarcode(sample)}>Print Barcode</button>
                                  {canEnterResults && sample.status !== "Completed" && sample.status !== "Cancelled" && <button type="button" style={smallButtonPurple} onClick={() => loadSampleToManual(sample)}>Load to Lab</button>}
                                  {canReceiveSamples && sample.status !== "Completed" && sample.status !== "Cancelled" && <button type="button" style={smallButtonOrange} onClick={() => cancelSample(sample.id)}>Cancel</button>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {canViewResultsPanel && (
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>{session.role === "Doctor" ? "Doctor Results Portal" : session.role === "Lab" ? "Lab Results Entry & Review" : "Results Overview"}</h2>
              <p style={{ color: "#64748b" }}>{session.role === "Doctor" ? "Search by MRN to review results, critical alerts, comments, and turnaround time." : "Enter results, review sync status, edit or cancel results, and monitor alerts."}</p>

              {canEnterResults && (
                <div style={{ ...reviewCardStyle, marginBottom: 18 }}>
                  <div style={{ fontWeight: "bold", marginBottom: 10 }}>Manual Result Entry</div>
                  <form onSubmit={handleSaveResult}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
                      <div><label>Barcode</label><input value={manualForm.barcode} onChange={(e) => setManualForm((prev) => ({ ...prev, barcode: e.target.value }))} style={inputStyle} placeholder="Barcode" /></div>
                      <div><label>MRN</label><input value={manualForm.mrn} onChange={(e) => setManualForm((prev) => ({ ...prev, mrn: e.target.value }))} style={inputStyle} placeholder="MRN" /></div>
                      <div><label>Patient Name</label><input value={manualForm.patient} onChange={(e) => setManualForm((prev) => ({ ...prev, patient: e.target.value }))} style={inputStyle} placeholder="Patient Name" /></div>
                      <div>
                        <label>Department</label>
                        <select value={manualForm.department} onChange={(e) => setManualForm((prev) => ({ ...prev, department: e.target.value }))} style={inputStyle}>
                          <option value="">Select department</option>
                          {DEPARTMENT_OPTIONS.map((department) => (<option key={department} value={department}>{department}</option>))}
                        </select>
                      </div>
                      <div>
                        <label>Test</label>
                        <select value={manualForm.test} onChange={(e) => setManualForm((prev) => ({ ...prev, test: e.target.value }))} style={inputStyle}>
                          {TEST_OPTIONS.map((test) => (<option key={test} value={test}>{test}</option>))}
                        </select>
                      </div>
                      <div><label>Result</label><input value={manualForm.result} onChange={(e) => setManualForm((prev) => ({ ...prev, result: e.target.value }))} style={inputStyle} placeholder="Enter result" /></div>
                      <div><label>Time (Optional)</label><input value={manualForm.time} onChange={(e) => setManualForm((prev) => ({ ...prev, time: e.target.value }))} style={inputStyle} placeholder="2026-04-21 10:50" /></div>
                      <div><label>Technician</label><input value={manualForm.technician} onChange={(e) => setManualForm((prev) => ({ ...prev, technician: e.target.value }))} style={inputStyle} placeholder="Technician name" /></div>
                      <div style={{ gridColumn: "1 / -1" }}><label>Comment / Note (Optional)</label><textarea value={manualForm.comment} onChange={(e) => setManualForm((prev) => ({ ...prev, comment: e.target.value }))} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="Optional comment for doctor or audit trail" /></div>
                    </div>
                    <div style={{ marginTop: 14 }}><button type="submit" style={buttonStyleInline}>Save Result</button></div>
                  </form>
                </div>
              )}

              {editingResultId && (
                <div style={editBoxStyle}>
                  <h3 style={{ marginTop: 0 }}>Edit Result</h3>
                  <div style={{ marginBottom: 12 }}><label>Result</label><textarea value={editForm.result} onChange={(e) => setEditForm((prev) => ({ ...prev, result: e.target.value }))} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} /></div>
                  <div style={{ marginBottom: 16 }}><label>Comment</label><textarea value={editForm.comment} onChange={(e) => setEditForm((prev) => ({ ...prev, comment: e.target.value }))} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} /></div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" style={smallButtonGreen} onClick={saveEditResult}>Save Edit</button>
                    <button type="button" style={smallButtonGray} onClick={() => setEditingResultId(null)}>Close</button>
                  </div>
                </div>
              )}

              <div style={{ overflowX: "auto", marginTop: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={thStyle}>Barcode</th>
                      <th style={thStyle}>MRN</th>
                      <th style={thStyle}>Department</th>
                      <th style={thStyle}>Patient</th>
                      <th style={thStyle}>Test</th>
                      <th style={thStyle}>Result</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Alert</th>
                      <th style={thStyle}>Sync</th>
                      <th style={thStyle}>Created At</th>
                      <th style={thStyle}>TAT</th>
                      <th style={thStyle}>Technician</th>
                      <th style={thStyle}>Comment</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleResults.map((item) => (
                      <tr key={item.id} style={item.status === "Critical" ? criticalRowStyle : undefined}>
                        <td style={tdStyle}>{item.barcode}</td>
                        <td style={tdStyle}>{item.mrn}</td>
                        <td style={tdStyle}>{item.department || "-"}</td>
                        <td style={tdStyle}>{item.patient}</td>
                        <td style={tdStyle}>{item.test}</td>
                        <td style={tdStyle}>{item.result}</td>
                        <td style={tdStyle}><span style={{ ...badgeStyle(item.status), borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>{item.status}</span></td>
                        <td style={tdStyle}><span style={{ ...(item.alertStatus === "Pending" ? badgeStyle("Critical") : item.alertStatus === "Acknowledged" ? syncBadgeStyle(true) : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }), borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>{item.alertStatus}</span></td>
                        <td style={tdStyle}><span style={{ ...syncBadgeStyle(item.synced), borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>{item.synced ? "Synced" : "Pending"}</span></td>
                        <td style={tdStyle}>{item.createdAt || "-"}</td>
                        <td style={{ ...tdStyle, ...tatStyle(item.tatMinutes) }}>{item.tatLabel}</td>
                        <td style={tdStyle}>{item.technician || "-"}</td>
                        <td style={tdStyle}>{item.comment || "-"}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {!item.synced && canEnterResults && !item.cancelled && <button type="button" style={smallButtonBlue} onClick={() => markSynced(item.id)}>Mark Sync</button>}
                            <button type="button" style={smallButtonGray} onClick={() => printResult(item)}>Print</button>
                            {canManageResults && !item.cancelled && (
                              <>
                                <button type="button" style={smallButtonPurple} onClick={() => beginEditResult(item)}>Edit</button>
                                <button type="button" style={smallButtonOrange} onClick={() => cancelResult(item)}>Cancel</button>
                              </>
                            )}
                            {session.role === "Doctor" && item.alertObj && !item.alertObj.seen && <button type="button" style={smallButtonOrange} onClick={() => markAlertSeen(item.alertObj.id)}>تم الاطلاع</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={aiNoteStyle}><strong>Prototype Notice:</strong> data is stored locally in this browser, with critical alerts, barcode printing, multi-test samples, audit trail, TAT KPI monitoring, and controlled result edit/cancel workflow.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #eef4fb 0%, #f8fafc 40%, #f8fafc 100%)",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
};

const panelStyle = {
  background: "rgba(255,255,255,0.97)",
  border: "1px solid #dbe4f0",
  borderRadius: "24px",
  padding: "24px",
  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
};

const topBannerStyle = {
  background: "linear-gradient(135deg, #0b1f3a 0%, #123a6b 60%, #1d4f91 100%)",
  color: "white",
  borderRadius: "26px",
  padding: "22px 24px",
  marginBottom: "24px",
  boxShadow: "0 14px 36px rgba(15, 23, 42, 0.18)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const topHospitalNameStyle = {
  fontSize: "13px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  opacity: 0.82,
  marginBottom: "6px",
};

const topSystemNameStyle = {
  margin: 0,
  fontSize: "34px",
  lineHeight: 1.15,
};

const topSubTextStyle = {
  marginTop: "8px",
  fontSize: "14px",
  opacity: 0.92,
};

const statusPillStyle = {
  background: "rgba(220, 38, 38, 0.18)",
  color: "#fee2e2",
  border: "1px solid rgba(254, 202, 202, 0.35)",
  padding: "10px 14px",
  borderRadius: "999px",
  fontWeight: "bold",
  fontSize: "13px",
};

const loggedUserStyle = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.12)",
  padding: "8px 12px",
  borderRadius: "14px",
  fontSize: "13px",
};

const headerButtonsRowStyle = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginTop: 18,
};

const loginPageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(180deg, #eef4fb 0%, #e2e8f0 100%)",
  padding: 24,
  fontFamily: "Arial, sans-serif",
};

const loginCardStyle = {
  width: "100%",
  maxWidth: 560,
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #dbe4f0",
  borderRadius: 28,
  padding: 28,
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.1)",
};

const loginHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 22,
  flexWrap: "wrap",
};

const loginHospitalNameStyle = {
  fontSize: 13,
  color: "#475569",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  marginBottom: 6,
};

const loginTitleStyle = {
  margin: 0,
  fontSize: 34,
  color: "#0f172a",
};

const loginSubtitleStyle = {
  color: "#475569",
  marginTop: 10,
  marginBottom: 0,
};

const demoBoxStyle = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e3a8a",
  borderRadius: 16,
  padding: 14,
  marginBottom: 18,
  lineHeight: 1.7,
};

const errorBoxStyle = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  borderRadius: 12,
  padding: 12,
  marginBottom: 14,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  marginTop: "6px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  background: "#0f172a",
  color: "white",
  border: "none",
  borderRadius: "12px",
  fontWeight: "bold",
  cursor: "pointer",
};

const buttonStyleInline = {
  padding: "12px 16px",
  background: "#0f172a",
  color: "white",
  border: "none",
  borderRadius: "12px",
  fontWeight: "bold",
  cursor: "pointer",
};

const smallButtonBlue = {
  padding: "8px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
};

const smallButtonGray = {
  padding: "8px 12px",
  background: "#475569",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
};

const smallButtonOrange = {
  padding: "8px 12px",
  background: "#ea580c",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
};

const smallButtonGreen = {
  padding: "8px 12px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
};

const smallButtonPurple = {
  padding: "8px 12px",
  background: "#7c3aed",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
};

const cardStyle = {
  background: "white",
  border: "1px solid #dbe4f0",
  borderRadius: "20px",
  padding: "18px",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
};

const reviewCardStyle = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "16px",
  padding: "16px",
};

const infoBoxStyle = {
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "12px",
  marginBottom: "12px",
};

const aiNoteStyle = {
  marginTop: "20px",
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: "16px",
  padding: "16px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const criticalAlertOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 20,
};

const criticalAlertBoxStyle = {
  width: "100%",
  maxWidth: 760,
  maxHeight: "85vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
  border: "2px solid #fecaca",
};

const criticalAlertHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 18,
  flexWrap: "wrap",
};

const criticalAlertTitleStyle = {
  fontSize: 26,
  fontWeight: "bold",
  color: "#b91c1c",
};

const criticalAlertCounterStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  fontSize: 14,
};

const criticalAlertListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const criticalAlertItemStyle = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 18,
  padding: 16,
};

const criticalAlertItemTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 12,
  flexWrap: "wrap",
};

const criticalAlertDetailsStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  lineHeight: 1.9,
};

const checkboxGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  marginTop: 8,
};

const checkboxItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 12px",
};

const dashboardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 20,
  marginBottom: 20,
};

const metricLabelStyle = {
  color: "#64748b",
  fontSize: 14,
};

const metricValueStyle = {
  fontSize: 28,
  fontWeight: "bold",
  marginTop: 8,
};

const filtersGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 10,
};

const criticalRowStyle = {
  background: "#fff7f7",
};

const editBoxStyle = {
  marginTop: 20,
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  padding: 16,
};
