import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEYS = {
  session: "lab_portal_session",
  results: "lab_portal_results",
  samples: "lab_portal_samples",
  entryMode: "lab_portal_entry_mode",
  form: "lab_portal_manual_form",
  scanForm: "lab_portal_scan_form",
  sampleForm: "lab_portal_sample_form",
  extractedData: "lab_portal_extracted_data",
  employees: "lab_portal_employees",
  criticalAlerts: "lab_portal_critical_alerts",
  auditLogs: "lab_portal_audit_logs",
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

const TEST_OPTIONS = ["CBC", "Potassium", "Creatinine", "Troponin"];
const SAMPLE_STATUS_OPTIONS = [
  "Received",
  "In Progress",
  "Partial Completed",
  "Completed",
  "Cancelled",
];
const RESULT_STATUS_OPTIONS = ["Normal", "Review", "Critical", "Cancelled"];

const HOSPITAL_NAME = "King Salman Armed Forces Hospital";
const SYSTEM_NAME = "Zero Downtime Lab Portal Prototype";

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getNowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getNowDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function safeRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
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

function uniqueValues(arr) {
  return [...new Set((arr || []).filter(Boolean))];
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

function formatTurnaround(minutes) {
  if (minutes == null) return "-";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}

function tatStyle(minutes) {
  if (minutes == null) return {};
  if (minutes > 60) return { color: "#b91c1c", fontWeight: "bold" };
  if (minutes > 30) return { color: "#b45309", fontWeight: "bold" };
  return { color: "#166534", fontWeight: "bold" };
}

function generateBarcodeSVG(value) {
  const CODE39 = {
    "0": "nnnwwnwnn",
    "1": "wnnwnnnnw",
    "2": "nnwwnnnnw",
    "3": "wnwwnnnnn",
    "4": "nnnwwnnnw",
    "5": "wnnwwnnnn",
    "6": "nnwwwnnnn",
    "7": "nnnwnnwnw",
    "8": "wnnwnnwnn",
    "9": "nnwwnnwnn",
    A: "wnnnnwnnw",
    B: "nnwnnwnnw",
    C: "wnwnnwnnn",
    D: "nnnnwwnnw",
    E: "wnnnwwnnn",
    F: "nnwnwwnnn",
    G: "nnnnnwwnw",
    H: "wnnnnwwnn",
    I: "nnwnnwwnn",
    J: "nnnnwwwnn",
    K: "wnnnnnnww",
    L: "nnwnnnnww",
    M: "wnwnnnnwn",
    N: "nnnnwnnww",
    O: "wnnnwnnwn",
    P: "nnwnwnnwn",
    Q: "nnnnnnwww",
    R: "wnnnnnwwn",
    S: "nnwnnnwwn",
    T: "nnnnwnwwn",
    U: "wwnnnnnnw",
    V: "nwwnnnnnw",
    W: "wwwnnnnnn",
    X: "nwnnwnnnw",
    Y: "wwnnwnnnn",
    Z: "nwwnwnnnn",
    "-": "nwnnnnwnw",
    ".": "wwnnnnwnn",
    " ": "nwwnnnwnn",
    "*": "nwnnwnwnn",
    $: "nwnwnwnnn",
    "/": "nwnwnnnwn",
    "+": "nwnnnwnwn",
    "%": "nnnwnwnwn",
  };

  const safeValue = String(value || "")
    .toUpperCase()
    .replace(/[^0-9A-Z .\-/$+%]/g, "-");

  const encoded = `*${safeValue}*`;
  const narrow = 2;
  const wide = 5;
  const height = 80;
  const gap = 2;

  let x = 0;
  let bars = "";

  for (let c = 0; c < encoded.length; c += 1) {
    const ch = encoded[c];
    const pattern = CODE39[ch] || CODE39["-"];

    for (let i = 0; i < pattern.length; i += 1) {
      const isBar = i % 2 === 0;
      const width = pattern[i] === "w" ? wide : narrow;
      if (isBar) bars += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000" />`;
      x += width;
    }

    if (c < encoded.length - 1) x += gap;
  }

  const totalWidth = x;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height + 28}" viewBox="0 0 ${totalWidth} ${height + 28}">
      ${bars}
      <text x="${totalWidth / 2}" y="${height + 20}" text-anchor="middle" font-size="15" font-family="Arial, sans-serif" fill="#111">
        ${escapeHtml(safeValue)}
      </text>
    </svg>
  `;
}

function getDefaultManualForm() {
  return {
    requestId: "",
    barcode: "",
    mrn: "",
    department: "",
    patient: "",
    test: "CBC",
    result: "",
    cbc: { wbc: "", rbc: "", hb: "", platelets: "" },
    time: "",
    technician: "",
    comment: "",
  };
}

function getDefaultScanForm() {
  return {
    requestId: "",
    barcode: "",
    mrn: "",
    department: "",
    patient: "",
    test: "CBC",
    time: "",
    technician: "",
    fileName: "",
    filePreview: "",
    fileType: "",
    ocrText: "",
    comment: "",
  };
}

function getDefaultSampleForm() {
  return {
    barcode: "",
    mrn: "",
    department: "",
    patient: "",
    tests: ["CBC"],
    receivedBy: "",
    time: "",
  };
}

function computeSampleStatus(sample) {
  if (sample.cancelled) return "Cancelled";
  const total = Array.isArray(sample.tests) ? sample.tests.length : 0;
  const completed = Array.isArray(sample.completedTests) ? sample.completedTests.length : 0;
  if (sample.status === "In Progress" && completed === 0) return "In Progress";
  if (completed === 0) return "Received";
  if (completed < total) return "Partial Completed";
  return "Completed";
}

function normalizeResults(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    id: item.id || createId(),
    requestId: item.requestId || "",
    barcode: item.barcode || "",
    mrn: item.mrn || "",
    department: item.department || "",
    patient: item.patient || "",
    test: item.test || "",
    result: item.result || "",
    status: item.status || "Normal",
    time: item.time || "",
    note: item.note || "",
    technician: item.technician || "",
    synced: !!item.synced,
    source: item.source || "Manual Entry",
    createdAt: item.createdAt || "",
    comment: item.comment || "",
    cancelled: !!item.cancelled,
    cancelledBy: item.cancelledBy || "",
    cancelledAt: item.cancelledAt || "",
    editedAt: item.editedAt || "",
    editedBy: item.editedBy || "",
  }));
}

function normalizeSamples(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const tests = Array.isArray(item.tests) ? item.tests : item.test ? [item.test] : ["CBC"];
    const completedTests = Array.isArray(item.completedTests) ? item.completedTests : [];
    const base = {
      id: item.id || createId(),
      barcode: item.barcode || "",
      mrn: item.mrn || "",
      department: item.department || "",
      patient: item.patient || "",
      tests,
      completedTests,
      receivedBy: item.receivedBy || "",
      time: item.time || "",
      createdAt: item.createdAt || getNowDateTime(),
      status: item.status || "Received",
      inProgress: !!item.inProgress,
      cancelled: !!item.cancelled,
    };
    return { ...base, status: computeSampleStatus(base) };
  });
}

function normalizeCriticalAlerts(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    id: item.id || createId(),
    resultId: item.resultId || "",
    mrn: item.mrn || "",
    patient: item.patient || "",
    test: item.test || "",
    result: item.result || "",
    status: item.status || "Critical",
    createdAt: item.createdAt || "",
    acknowledged: !!item.acknowledged,
    acknowledgedBy: item.acknowledgedBy || "",
    acknowledgedAt: item.acknowledgedAt || "",
    comment: item.comment || "",
  }));
}

function normalizeAuditLogs(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    id: item.id || createId(),
    action: item.action || "",
    actor: item.actor || "",
    role: item.role || "",
    details: item.details || "",
    createdAt: item.createdAt || getNowDateTime(),
  }));
}

export default function App() {
  const [session, setSession] = useState(() => safeRead(STORAGE_KEYS.session, null));
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [results, setResults] = useState(() => normalizeResults(safeRead(STORAGE_KEYS.results, [])));
  const [samples, setSamples] = useState(() => normalizeSamples(safeRead(STORAGE_KEYS.samples, [])));
  const [search, setSearch] = useState("");
  const [entryMode, setEntryMode] = useState(() => safeRead(STORAGE_KEYS.entryMode, "manual"));
  const [form, setForm] = useState(() => ({ ...getDefaultManualForm(), ...safeRead(STORAGE_KEYS.form, getDefaultManualForm()) }));
  const [scanForm, setScanForm] = useState(() => ({ ...getDefaultScanForm(), ...safeRead(STORAGE_KEYS.scanForm, getDefaultScanForm()) }));
  const [sampleForm, setSampleForm] = useState(() => ({ ...getDefaultSampleForm(), ...safeRead(STORAGE_KEYS.sampleForm, getDefaultSampleForm()) }));
  const [extractedData, setExtractedData] = useState(() => safeRead(STORAGE_KEYS.extractedData, null));
  const [employees, setEmployees] = useState(() =>
    safeRead(STORAGE_KEYS.employees, [
      { id: 1, username: "lab", password: "1234", role: "Lab", name: "Laboratory Staff", active: true },
      { id: 2, username: "reception1", password: "1234", role: "Reception", name: "Reception Staff", active: true },
    ])
  );
  const [criticalAlerts, setCriticalAlerts] = useState(() => normalizeCriticalAlerts(safeRead(STORAGE_KEYS.criticalAlerts, [])));
  const [auditLogs, setAuditLogs] = useState(() => normalizeAuditLogs(safeRead(STORAGE_KEYS.auditLogs, [])));
  const [employeeForm, setEmployeeForm] = useState({ name: "", username: "", password: "", role: "Lab" });
  const [filters, setFilters] = useState({ department: "", test: "", resultStatus: "", syncStatus: "", alertStatus: "", sampleStatus: "" });
  const [editingResultId, setEditingResultId] = useState("");
  const [editForm, setEditForm] = useState({ result: "", comment: "", time: "", note: "" });

  const importInputRef = useRef(null);
  const lastPlayedAlertIdsRef = useRef([]);

  const fixedUsers = {
    admin: { username: "admin", password: "1234", role: "Admin", name: "System Administrator", active: true },
    doctor: { username: "doctor", password: "1234", role: "Doctor", name: "Duty Doctor", active: true },
    reception: { username: "reception", password: "1234", role: "Reception", name: "Sample Reception Staff", active: true },
  };

  const canEnterResults = session?.role === "Lab" || session?.role === "All" || session?.role === "Admin";
  const canReceiveSamples = session?.role === "Reception" || session?.role === "All" || session?.role === "Admin";
  const canViewResultsPanel = session?.role !== "Reception";
  const canManageResults = session?.role === "Lab" || session?.role === "Admin";

  function addAuditLog(action, details) {
    if (!session) return;
    const entry = {
      id: createId(),
      action,
      actor: session.name,
      role: session.role,
      details,
      createdAt: getNowDateTime(),
    };
    setAuditLogs((prev) => [entry, ...prev].slice(0, 300));
  }

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.results, JSON.stringify(results)); }, [results]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.samples, JSON.stringify(samples)); }, [samples]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.entryMode, JSON.stringify(entryMode)); }, [entryMode]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.form, JSON.stringify(form)); }, [form]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.scanForm, JSON.stringify(scanForm)); }, [scanForm]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.sampleForm, JSON.stringify(sampleForm)); }, [sampleForm]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.extractedData, JSON.stringify(extractedData)); }, [extractedData]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session)); }, [session]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.criticalAlerts, JSON.stringify(criticalAlerts)); }, [criticalAlerts]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(auditLogs)); }, [auditLogs]);

  useEffect(() => {
    if (!session) return;
    if (canEnterResults) {
      setForm((prev) => ({ ...prev, technician: prev.technician || session.name }));
      setScanForm((prev) => ({ ...prev, technician: prev.technician || session.name }));
    }
    if (canReceiveSamples) {
      setSampleForm((prev) => ({ ...prev, receivedBy: prev.receivedBy || session.name }));
    }
  }, [session, canEnterResults, canReceiveSamples]);

  useEffect(() => {
    return () => {
      if (scanForm.filePreview) URL.revokeObjectURL(scanForm.filePreview);
    };
  }, [scanForm.filePreview]);

  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key === STORAGE_KEYS.results) setResults(normalizeResults(safeRead(STORAGE_KEYS.results, [])));
      if (e.key === STORAGE_KEYS.samples) setSamples(normalizeSamples(safeRead(STORAGE_KEYS.samples, [])));
      if (e.key === STORAGE_KEYS.criticalAlerts) setCriticalAlerts(normalizeCriticalAlerts(safeRead(STORAGE_KEYS.criticalAlerts, [])));
      if (e.key === STORAGE_KEYS.auditLogs) setAuditLogs(normalizeAuditLogs(safeRead(STORAGE_KEYS.auditLogs, [])));
    }
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const alertMapByResultId = useMemo(() => {
    const map = {};
    criticalAlerts.forEach((item) => {
      if (item.resultId) map[item.resultId] = item;
    });
    return map;
  }, [criticalAlerts]);

  const pendingDoctorAlerts = useMemo(() => criticalAlerts.filter((item) => !item.acknowledged), [criticalAlerts]);

  useEffect(() => {
    function playCriticalAlertSound() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        const notes = [880, 660, 880];
        notes.forEach((freq, index) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          const start = audioCtx.currentTime + index * 0.22;
          const end = start + 0.16;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.start(start);
          osc.stop(end + 0.02);
        });
      } catch {}
    }

    if (session?.role !== "Doctor") return;
    const newUnheardAlerts = pendingDoctorAlerts.filter((item) => !lastPlayedAlertIdsRef.current.includes(item.id));
    if (newUnheardAlerts.length) {
      playCriticalAlertSound();
      lastPlayedAlertIdsRef.current = [...lastPlayedAlertIdsRef.current, ...newUnheardAlerts.map((item) => item.id)];
    }
  }, [pendingDoctorAlerts, session]);

  function isDuplicateSample(candidate) {
    const normalizedBarcode = candidate.barcode.trim().toLowerCase();
    const normalizedMrn = candidate.mrn.trim().toLowerCase();
    const normalizedTests = uniqueValues(candidate.tests).sort().join("|");
    return samples.some((sample) => {
      if (sample.cancelled) return false;
      const sameBarcode = normalizedBarcode && sample.barcode.trim().toLowerCase() === normalizedBarcode;
      const sameMrnAndTests = sample.mrn.trim().toLowerCase() === normalizedMrn && uniqueValues(sample.tests).sort().join("|") === normalizedTests && sample.status !== "Completed";
      return sameBarcode || sameMrnAndTests;
    });
  }

  function isDuplicateResult(candidate) {
    return results.some((item) => {
      if (item.cancelled) return false;
      const sameRequestAndTest = candidate.requestId && item.requestId === candidate.requestId && item.test === candidate.test;
      const sameBarcodeMrnTest = item.barcode === candidate.barcode && item.mrn === candidate.mrn && item.test === candidate.test && item.status !== "Cancelled";
      return sameRequestAndTest || sameBarcodeMrnTest;
    });
  }

  function updateSampleStatus(sampleId, updates) {
    setSamples((prev) =>
      prev.map((sample) => {
        if (sample.id !== sampleId) return sample;
        const updated = { ...sample, ...updates };
        return { ...updated, status: computeSampleStatus(updated) };
      })
    );
  }

  function getRemainingTestsForSample(sample) {
    return sample.tests.filter((test) => !sample.completedTests.includes(test));
  }

  function handleLogin(e) {
    e.preventDefault();
    const username = loginForm.username.trim().toLowerCase();
    const password = loginForm.password;
    const fixedUser = fixedUsers[username];

    if (fixedUser) {
      if (!fixedUser.active || fixedUser.password !== password) {
        setLoginError("Invalid username or password");
        return;
      }
      setSession(fixedUser);
      setLoginError("");
      setSearch("");
      return;
    }

    const employee = employees.find(
      (emp) => emp.username.toLowerCase() === username && emp.password === password && emp.active
    );

    if (!employee) {
      setLoginError("Invalid username or password");
      return;
    }

    setSession(employee);
    setLoginError("");
    setSearch("");
  }

  function handleLogout() {
    setSession(null);
    setLoginForm({ username: "", password: "" });
    setLoginError("");
    setSearch("");
    localStorage.removeItem(STORAGE_KEYS.session);
  }

  function resetAllSavedData() {
    const ok = window.confirm("This will clear all saved downtime data from this browser. Continue?");
    if (!ok) return;

    if (scanForm.filePreview) URL.revokeObjectURL(scanForm.filePreview);
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));

    setResults([]);
    setSamples([]);
    setEntryMode("manual");
    setForm({ ...getDefaultManualForm(), technician: session?.name || "" });
    setScanForm({ ...getDefaultScanForm(), technician: session?.name || "" });
    setSampleForm({ ...getDefaultSampleForm(), receivedBy: session?.name || "" });
    setExtractedData(null);
    setEmployees([
      { id: 1, username: "lab", password: "1234", role: "Lab", name: "Laboratory Staff", active: true },
      { id: 2, username: "reception1", password: "1234", role: "Reception", name: "Reception Staff", active: true },
    ]);
    setCriticalAlerts([]);
    setAuditLogs([]);
    setSearch("");
    lastPlayedAlertIdsRef.current = [];
  }

  function handleExportCSV() {
    if (!results.length) {
      alert("No results available to export");
      return;
    }

    const headers = [
      "ID", "RequestID", "Barcode", "MRN", "Department", "Patient", "Test", "Result", "Status",
      "AlertStatus", "Synced", "Source", "Time", "CreatedAt", "Technician", "Note", "Comment", "TAT",
      "Cancelled", "CancelledBy", "CancelledAt", "EditedBy", "EditedAt",
    ];

    const rows = results.map((item) => {
      const sample = samples.find((s) => s.id === item.requestId) || samples.find((s) => s.barcode === item.barcode);
      return [
        item.id,
        item.requestId,
        item.barcode,
        item.mrn,
        item.department,
        item.patient,
        item.test,
        item.result,
        item.status,
        alertMapByResultId[item.id] ? (alertMapByResultId[item.id].acknowledged ? "Acknowledged" : "Pending") : item.status === "Critical" ? "Pending" : "-",
        item.synced ? "Yes" : "No",
        item.source,
        item.time,
        item.createdAt,
        item.technician,
        item.note,
        item.comment,
        formatTurnaround(getTurnaroundMinutes(sample, item)),
        item.cancelled ? "Yes" : "No",
        item.cancelledBy,
        item.cancelledAt,
        item.editedBy,
        item.editedAt,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/\"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "downtime_lab_results.csv");
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
          alert("The selected CSV file is empty");
          return;
        }

        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) {
          alert("CSV file does not contain any result rows");
          return;
        }

        const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
        const requiredHeaders = ["barcode", "mrn", "patient", "test", "result"];
        const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

        if (missingHeaders.length) {
          alert(`Missing required columns: ${missingHeaders.join(", ")}`);
          return;
        }

        const importedRows = lines.slice(1).map((line) => {
          const cols = parseCSVLine(line);
          const row = {};
          headers.forEach((header, index) => {
            row[header] = cols[index] ?? "";
          });

          return {
            id: row.id || createId(),
            requestId: row.requestid || "",
            barcode: row.barcode || "",
            mrn: row.mrn || "",
            department: row.department || "",
            patient: row.patient || "",
            test: row.test || "",
            result: row.result || "",
            status: row.status || "Normal",
            synced: String(row.synced || "").toLowerCase() === "yes",
            source: row.source || "Imported CSV",
            time: row.time || "",
            createdAt: row.createdat || getNowDateTime(),
            technician: row.technician || "",
            note: row.note || "Imported from CSV",
            comment: row.comment || "",
            cancelled: String(row.cancelled || "").toLowerCase() === "yes",
            cancelledBy: row.cancelledby || "",
            cancelledAt: row.cancelledat || "",
            editedBy: row.editedby || "",
            editedAt: row.editedat || "",
          };
        });

        const validRows = importedRows.filter((row) => row.barcode || row.mrn || row.patient || row.test || row.result);
        if (!validRows.length) {
          alert("No valid rows found in the CSV file");
          return;
        }

        const replaceExisting = window.confirm("Do you want to replace existing results?\nPress OK to replace, or Cancel to append.");
        if (replaceExisting) setResults(validRows);
        else setResults((prev) => [...validRows, ...prev]);

        addAuditLog("Results Imported", `${validRows.length} result(s) imported from CSV`);
        alert(`Imported ${validRows.length} result(s) successfully.`);
      } catch {
        alert("Failed to import CSV file");
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  }

  function toggleSampleTest(test) {
    setSampleForm((prev) => {
      const exists = prev.tests.includes(test);
      const nextTests = exists ? prev.tests.filter((t) => t !== test) : [...prev.tests, test];
      return { ...prev, tests: nextTests.length ? nextTests : [test] };
    });
  }

  function handleAddSample(e) {
    e.preventDefault();
    if (!canReceiveSamples) return;

    if (!sampleForm.barcode || !sampleForm.mrn || !sampleForm.department || !sampleForm.patient || !sampleForm.receivedBy || !sampleForm.tests.length) {
      alert("Please fill all required fields");
      return;
    }

    const newSample = {
      id: createId(),
      barcode: sampleForm.barcode.trim(),
      mrn: sampleForm.mrn.trim(),
      department: sampleForm.department,
      patient: sampleForm.patient.trim(),
      tests: uniqueValues(sampleForm.tests),
      completedTests: [],
      receivedBy: sampleForm.receivedBy.trim(),
      time: sampleForm.time || getNowTime(),
      createdAt: getNowDateTime(),
      status: "Received",
      inProgress: false,
      cancelled: false,
    };

    if (isDuplicateSample(newSample)) {
      alert("Possible duplicate sample detected. Please review barcode, MRN, or requested tests.");
      return;
    }

    setSamples((prev) => [newSample, ...prev]);
    addAuditLog("Sample Received", `Barcode ${newSample.barcode} | MRN ${newSample.mrn} | Tests: ${newSample.tests.join(", ")}`);
    setSampleForm({ ...getDefaultSampleForm(), receivedBy: session.name });
  }

  function loadSampleToEntry(sample, mode = "manual") {
    if (!canEnterResults) return;
    const remainingTests = getRemainingTestsForSample(sample);
    const selectedTest = remainingTests[0] || sample.tests[0] || "CBC";

    updateSampleStatus(sample.id, { status: "In Progress", inProgress: true });
    addAuditLog("Sample Loaded", `Barcode ${sample.barcode} loaded to ${mode} entry for test ${selectedTest}`);

    if (mode === "manual") {
      setForm({
        ...getDefaultManualForm(),
        requestId: sample.id,
        barcode: sample.barcode,
        mrn: sample.mrn,
        department: sample.department,
        patient: sample.patient,
        test: selectedTest,
        technician: session.name,
      });
      setEntryMode("manual");
      return;
    }

    setScanForm({
      ...getDefaultScanForm(),
      requestId: sample.id,
      barcode: sample.barcode,
      mrn: sample.mrn,
      department: sample.department,
      patient: sample.patient,
      test: selectedTest,
      technician: session.name,
    });
    setExtractedData(null);
    setEntryMode("scan");
  }

  function getStatus(test, result, cbc) {
    const value = parseFloat(result);

    if (test === "Potassium" && !Number.isNaN(value)) {
      if (value >= 6) return "Critical";
      if (value >= 5.3) return "Review";
      return "Normal";
    }

    if (test === "Creatinine" && !Number.isNaN(value)) {
      if (value >= 2) return "Review";
      return "Normal";
    }

    if (test === "Troponin" && !Number.isNaN(value)) {
      if (value >= 0.1) return "Review";
      return "Normal";
    }

    if (test === "CBC") {
      const hb = parseFloat(cbc?.hb);
      const platelets = parseFloat(cbc?.platelets);
      const wbc = parseFloat(cbc?.wbc);
      if (!Number.isNaN(hb) && hb < 7) return "Critical";
      if (!Number.isNaN(hb) && hb < 10) return "Review";
      if (!Number.isNaN(platelets) && platelets < 50) return "Review";
      if (!Number.isNaN(wbc) && wbc > 20) return "Review";
      return "Normal";
    }

    return "Normal";
  }

  function createCriticalAlert(resultItem) {
    setCriticalAlerts((prev) => {
      const exists = prev.some((item) => item.resultId === resultItem.id);
      if (exists) return prev;
      const newAlert = {
        id: createId(),
        resultId: resultItem.id,
        mrn: resultItem.mrn,
        patient: resultItem.patient,
        test: resultItem.test,
        result: resultItem.result,
        status: resultItem.status,
        createdAt: resultItem.createdAt,
        acknowledged: false,
        acknowledgedBy: "",
        acknowledgedAt: "",
        comment: resultItem.comment || "",
      };
      return [newAlert, ...prev];
    });

    addAuditLog("Critical Alert Created", `MRN ${resultItem.mrn} | ${resultItem.test} | Result ${resultItem.result}`);
  }

  function acknowledgeCriticalAlert(alertId) {
    const alertItem = criticalAlerts.find((item) => item.id === alertId);
    setCriticalAlerts((prev) =>
      prev.map((item) =>
        item.id === alertId
          ? { ...item, acknowledged: true, acknowledgedBy: session?.name || "", acknowledgedAt: getNowDateTime() }
          : item
      )
    );

    if (alertItem) addAuditLog("Critical Alert Acknowledged", `MRN ${alertItem.mrn} | ${alertItem.test} acknowledged by doctor`);
  }

  function registerResultSave(newResult) {
    setResults((prev) => [newResult, ...prev]);
    if (newResult.status === "Critical") createCriticalAlert(newResult);

    if (newResult.requestId) {
      const targetSample = samples.find((item) => item.id === newResult.requestId);
      if (targetSample) {
        const completedTests = uniqueValues([...targetSample.completedTests, newResult.test]);
        updateSampleStatus(newResult.requestId, {
          completedTests,
          inProgress: completedTests.length < targetSample.tests.length,
        });
      }
    }

    addAuditLog("Result Saved", `MRN ${newResult.mrn} | ${newResult.test} | ${newResult.status}`);
  }

  function handleAddResult(e) {
    e.preventDefault();
    if (!canEnterResults) return;

    if (!form.barcode || !form.mrn || !form.department || !form.patient || !form.test || !form.technician) {
      alert("Please fill all required fields");
      return;
    }

    if (form.test === "CBC") {
      if (!form.cbc.wbc || !form.cbc.rbc || !form.cbc.hb || !form.cbc.platelets) {
        alert("Please fill all CBC fields");
        return;
      }
    } else if (!form.result) {
      alert("Please enter the result");
      return;
    }

    let finalResult = form.result;
    if (form.test === "CBC") {
      finalResult = `WBC: ${form.cbc.wbc} | RBC: ${form.cbc.rbc} | Hb: ${form.cbc.hb} | Platelets: ${form.cbc.platelets}`;
    }

    const status = getStatus(form.test, form.result, form.cbc);

    const newResult = {
      id: createId(),
      requestId: form.requestId,
      barcode: form.barcode.trim(),
      mrn: form.mrn.trim(),
      department: form.department,
      patient: form.patient.trim(),
      test: form.test,
      result: finalResult,
      time: form.time || getNowTime(),
      status,
      note: "Issued during LIS downtime",
      technician: form.technician.trim(),
      synced: false,
      source: "Manual Entry",
      createdAt: getNowDateTime(),
      comment: form.comment?.trim() || "",
      cancelled: false,
      cancelledBy: "",
      cancelledAt: "",
      editedAt: "",
      editedBy: "",
    };

    if (isDuplicateResult(newResult)) {
      alert("Duplicate result detected for the same sample/test.");
      return;
    }

    registerResultSave(newResult);
    setForm({ ...getDefaultManualForm(), technician: session.name });
  }

  function parseValue(text, label) {
    const regex = new RegExp(`${label}\\s*[:=]?\\s*([0-9.]+)`, "i");
    const match = text.match(regex);
    return match ? match[1] : "";
  }

  function extractFromOCR() {
    if (!scanForm.ocrText.trim()) {
      alert("Please paste OCR text first");
      return;
    }

    const text = scanForm.ocrText;

    if (scanForm.test === "CBC") {
      const cbc = {
        wbc: parseValue(text, "WBC"),
        rbc: parseValue(text, "RBC"),
        hb: parseValue(text, "HB"),
        platelets: parseValue(text, "Platelets"),
      };
      const status = getStatus("CBC", "", cbc);
      setExtractedData({
        test: "CBC",
        result: `WBC: ${cbc.wbc || "-"} | RBC: ${cbc.rbc || "-"} | Hb: ${cbc.hb || "-"} | Platelets: ${cbc.platelets || "-"}`,
        cbc,
        status,
      });
      return;
    }

    const singleResult =
      parseValue(text, scanForm.test) ||
      parseValue(text, scanForm.test.toUpperCase()) ||
      parseValue(text, scanForm.test.toLowerCase());

    const status = getStatus(scanForm.test, singleResult, null);
    setExtractedData({ test: scanForm.test, result: singleResult || "", cbc: null, status });
  }

  function handleScanFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (scanForm.filePreview) URL.revokeObjectURL(scanForm.filePreview);
    const previewUrl = URL.createObjectURL(file);
    setScanForm((prev) => ({ ...prev, fileName: file.name, filePreview: previewUrl, fileType: file.type }));
  }

  function handleSaveScannedResult() {
    if (!canEnterResults) return;

    if (!scanForm.barcode || !scanForm.mrn || !scanForm.department || !scanForm.patient || !scanForm.test || !scanForm.technician) {
      alert("Please fill all required fields");
      return;
    }
    if (!extractedData) {
      alert("Please extract results first");
      return;
    }

    const newResult = {
      id: createId(),
      requestId: scanForm.requestId,
      barcode: scanForm.barcode.trim(),
      mrn: scanForm.mrn.trim(),
      department: scanForm.department,
      patient: scanForm.patient.trim(),
      test: scanForm.test,
      result: extractedData.result,
      time: scanForm.time || getNowTime(),
      status: extractedData.status,
      note: "Extracted from scanned result sheet",
      technician: scanForm.technician.trim(),
      synced: false,
      source: "Scanned Sheet",
      createdAt: getNowDateTime(),
      comment: scanForm.comment?.trim() || "",
      cancelled: false,
      cancelledBy: "",
      cancelledAt: "",
      editedAt: "",
      editedBy: "",
    };

    if (isDuplicateResult(newResult)) {
      alert("Duplicate result detected for the same sample/test.");
      return;
    }

    registerResultSave(newResult);
    if (scanForm.filePreview) URL.revokeObjectURL(scanForm.filePreview);
    setScanForm({ ...getDefaultScanForm(), technician: session.name });
    setExtractedData(null);
  }

  function handleSync(id) {
    if (!canEnterResults) return;
    const target = results.find((item) => item.id === id);
    setResults((prev) => prev.map((item) => item.id === id ? { ...item, synced: true, note: "Marked for LIS reconciliation" } : item));
    if (target) addAuditLog("Result Marked for LIS Entry", `MRN ${target.mrn} | ${target.test}`);
  }

  function startEditResult(item) {
    setEditingResultId(item.id);
    setEditForm({ result: item.result, comment: item.comment || "", time: item.time || "", note: item.note || "" });
  }

  function saveEditedResult() {
    if (!editingResultId) return;
    const target = results.find((item) => item.id === editingResultId);
    if (!target) return;
    if (!editForm.result.trim()) {
      alert("Result cannot be empty");
      return;
    }

    const updatedResultStatus = target.test === "CBC" ? target.status : getStatus(target.test, editForm.result.trim(), null);

    setResults((prev) =>
      prev.map((item) =>
        item.id === editingResultId
          ? {
              ...item,
              result: editForm.result.trim(),
              comment: editForm.comment.trim(),
              time: editForm.time.trim(),
              note: editForm.note.trim(),
              status: item.test === "CBC" ? item.status : updatedResultStatus,
              editedAt: getNowDateTime(),
              editedBy: session.name,
            }
          : item
      )
    );

    if (updatedResultStatus === "Critical" && target.status !== "Critical") {
      createCriticalAlert({
        ...target,
        result: editForm.result.trim(),
        comment: editForm.comment.trim(),
        status: updatedResultStatus,
        createdAt: target.createdAt,
      });
    }

    addAuditLog("Result Edited", `MRN ${target.mrn} | ${target.test}`);
    setEditingResultId("");
  }

  function handleCancelResult(item) {
    if (!canManageResults) return;
    const ok = window.confirm("Cancel this result?");
    if (!ok) return;

    setResults((prev) =>
      prev.map((resultItem) =>
        resultItem.id === item.id
          ? {
              ...resultItem,
              status: "Cancelled",
              cancelled: true,
              cancelledBy: session.name,
              cancelledAt: getNowDateTime(),
              note: "Result cancelled",
              synced: false,
            }
          : resultItem
      )
    );

    if (item.requestId) {
      const sample = samples.find((s) => s.id === item.requestId);
      if (sample) {
        const completedTests = sample.completedTests.filter((t) => t !== item.test);
        updateSampleStatus(item.requestId, { completedTests, inProgress: false });
      }
    }

    addAuditLog("Result Cancelled", `MRN ${item.mrn} | ${item.test}`);
  }

  function handleCancelSample(sample) {
    const ok = window.confirm("Cancel this sample request?");
    if (!ok) return;
    updateSampleStatus(sample.id, { cancelled: true, status: "Cancelled", inProgress: false });
    addAuditLog("Sample Cancelled", `Barcode ${sample.barcode} | MRN ${sample.mrn}`);
  }

  function handlePrintSampleBarcode(sample) {
    const barcodeSvg = generateBarcodeSVG(sample.barcode || sample.mrn || sample.id);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Sample Barcode Label</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8fafc; color: #0f172a; }
            .label { width: 440px; border: 2px solid #0f172a; border-radius: 18px; background: #fff; padding: 18px; margin: 0 auto; box-sizing: border-box; }
            .header { text-align: center; margin-bottom: 10px; }
            .hospital { font-size: 12px; text-transform: uppercase; color: #475569; letter-spacing: 1px; }
            .title { font-size: 22px; font-weight: bold; margin-top: 6px; }
            .barcode-box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; background: #fff; text-align: center; margin: 14px 0 16px; }
            .info-row { margin-bottom: 10px; font-size: 15px; }
            .label-text { font-weight: bold; color: #475569; }
            @media print { body { background: #fff; padding: 0; } .label { border: 1px solid #000; border-radius: 0; width: 100%; margin: 0; } }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              <div class="hospital">${escapeHtml(HOSPITAL_NAME)}</div>
              <div class="title">Sample Barcode Label</div>
            </div>
            <div class="barcode-box">${barcodeSvg}</div>
            <div class="info-row"><span class="label-text">Patient:</span> ${escapeHtml(sample.patient || "-")}</div>
            <div class="info-row"><span class="label-text">MRN:</span> ${escapeHtml(sample.mrn || "-")}</div>
            <div class="info-row"><span class="label-text">Department:</span> ${escapeHtml(sample.department || "-")}</div>
            <div class="info-row"><span class="label-text">Barcode:</span> ${escapeHtml(sample.barcode || "-")}</div>
            <div class="info-row"><span class="label-text">Requested Tests:</span> ${escapeHtml((sample.tests || []).join(", ") || "-")}</div>
            <div class="info-row"><span class="label-text">Status:</span> ${escapeHtml(sample.status || "-")}</div>
          </div>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `);

    printWindow.document.close();
    addAuditLog("Barcode Printed", `Barcode ${sample.barcode} | MRN ${sample.mrn}`);
  }

  function handlePrintResult(item) {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;

    const alertStatus = alertMapByResultId[item.id]
      ? alertMapByResultId[item.id].acknowledged ? "Acknowledged" : "Pending"
      : item.status === "Critical" ? "Pending" : "-";

    const sample = samples.find((s) => s.id === item.requestId) || samples.find((s) => s.barcode === item.barcode);

    reportWindow.document.write(`
      <html>
        <head>
          <title>${SYSTEM_NAME}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #0f172a; }
            h1 { margin: 0 0 8px 0; font-size: 26px; }
            h2 { margin: 0; font-size: 16px; color: #475569; }
            .top { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
            .box { border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; margin-top: 20px; }
            .label { color: #475569; font-weight: bold; }
            .note { margin-top: 20px; color: #b45309; }
          </style>
        </head>
        <body>
          <div class="top">
            <div>
              <h2>${HOSPITAL_NAME}</h2>
              <h1>${SYSTEM_NAME}</h1>
            </div>
          </div>
          <p>This result was issued during LIS downtime.</p>
          <div class="box">
            <p><span class="label">Barcode:</span> ${escapeHtml(item.barcode)}</p>
            <p><span class="label">MRN:</span> ${escapeHtml(item.mrn)}</p>
            <p><span class="label">Department:</span> ${escapeHtml(item.department || "-")}</p>
            <p><span class="label">Patient:</span> ${escapeHtml(item.patient)}</p>
            <p><span class="label">Test:</span> ${escapeHtml(item.test)}</p>
            <p><span class="label">Result:</span> ${escapeHtml(item.result)}</p>
            <p><span class="label">Status:</span> ${escapeHtml(item.status)}</p>
            <p><span class="label">Alert Status:</span> ${escapeHtml(alertStatus)}</p>
            <p><span class="label">Time:</span> ${escapeHtml(item.time)}</p>
            <p><span class="label">Created At:</span> ${escapeHtml(item.createdAt || "-")}</p>
            <p><span class="label">TAT:</span> ${escapeHtml(formatTurnaround(getTurnaroundMinutes(sample, item)))}</p>
            <p><span class="label">Technician:</span> ${escapeHtml(item.technician)}</p>
            <p><span class="lab
