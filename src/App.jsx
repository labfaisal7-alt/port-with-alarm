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
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getNowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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
    .replace(/"/g, "&quot;");
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

      if (isBar) {
        bars += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000" />`;
      }
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
    cbc: {
      wbc: "",
      rbc: "",
      hb: "",
      platelets: "",
    },
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
    const tests = Array.isArray(item.tests)
      ? item.tests
      : item.test
      ? [item.test]
      : ["CBC"];

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

    return {
      ...base,
      status: computeSampleStatus(base),
    };
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

function uniqueValues(arr) {
  return [...new Set(arr.filter(Boolean))];
}

export default function App() {
  const [session, setSession] = useState(() => safeRead(STORAGE_KEYS.session, null));
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  const [results, setResults] = useState(() =>
    normalizeResults(safeRead(STORAGE_KEYS.results, []))
  );
  const [samples, setSamples] = useState(() =>
    normalizeSamples(safeRead(STORAGE_KEYS.samples, []))
  );
  const [search, setSearch] = useState("");
  const [entryMode, setEntryMode] = useState(() => safeRead(STORAGE_KEYS.entryMode, "manual"));
  const [form, setForm] = useState(() => ({
    ...getDefaultManualForm(),
    ...safeRead(STORAGE_KEYS.form, getDefaultManualForm()),
  }));
  const [scanForm, setScanForm] = useState(() => ({
    ...getDefaultScanForm(),
    ...safeRead(STORAGE_KEYS.scanForm, getDefaultScanForm()),
  }));
  const [sampleForm, setSampleForm] = useState(() => ({
    ...getDefaultSampleForm(),
    ...safeRead(STORAGE_KEYS.sampleForm, getDefaultSampleForm()),
  }));
  const [extractedData, setExtractedData] = useState(() =>
    safeRead(STORAGE_KEYS.extractedData, null)
  );
  const [employees, setEmployees] = useState(() =>
    safeRead(STORAGE_KEYS.employees, [
      {
        id: 1,
        username: "lab",
        password: "1234",
        role: "Lab",
        name: "Laboratory Staff",
        active: true,
      },
      {
        id: 2,
        username: "reception1",
        password: "1234",
        role: "Reception",
        name: "Reception Staff",
        active: true,
      },
    ])
  );
  const [criticalAlerts, setCriticalAlerts] = useState(() =>
    normalizeCriticalAlerts(safeRead(STORAGE_KEYS.criticalAlerts, []))
  );
  const [auditLogs, setAuditLogs] = useState(() =>
    normalizeAuditLogs(safeRead(STORAGE_KEYS.auditLogs, []))
  );

  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "Lab",
  });

  const [filters, setFilters] = useState({
    department: "",
    test: "",
    resultStatus: "",
    syncStatus: "",
    alertStatus: "",
    sampleStatus: "",
  });

  const [editingResultId, setEditingResultId] = useState("");
  const [editForm, setEditForm] = useState({
    result: "",
    comment: "",
    time: "",
    note: "",
  });

  const importInputRef = useRef(null);
  const lastPlayedAlertIdsRef = useRef([]);

  const fixedUsers = {
    admin: {
      username: "admin",
      password: "1234",
      role: "Admin",
      name: "System Administrator",
      active: true,
    },
    doctor: {
      username: "doctor",
      password: "1234",
      role: "Doctor",
      name: "Duty Doctor",
      active: true,
    },
    reception: {
      username: "reception",
      password: "1234",
      role: "Reception",
      name: "Sample Reception Staff",
      active: true,
    },
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.results, JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.samples, JSON.stringify(samples));
  }, [samples]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.entryMode, JSON.stringify(entryMode));
  }, [entryMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.form, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.scanForm, JSON.stringify(scanForm));
  }, [scanForm]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sampleForm, JSON.stringify(sampleForm));
  }, [sampleForm]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.extractedData, JSON.stringify(extractedData));
  }, [extractedData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.criticalAlerts, JSON.stringify(criticalAlerts));
  }, [criticalAlerts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    if (!session) return;

    if (canEnterResults) {
      setForm((prev) => ({
        ...prev,
        technician: prev.technician || session.name,
      }));
      setScanForm((prev) => ({
        ...prev,
        technician: prev.technician || session.name,
      }));
    }

    if (canReceiveSamples) {
      setSampleForm((prev) => ({
        ...prev,
        receivedBy: prev.receivedBy || session.name,
      }));
    }
  }, [session, canEnterResults, canReceiveSamples]);

  useEffect(() => {
    return () => {
      if (scanForm.filePreview) URL.revokeObjectURL(scanForm.filePreview);
    };
  }, [scanForm.filePreview]);

  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key === STORAGE_KEYS.results) {
        setResults(normalizeResults(safeRead(STORAGE_KEYS.results, [])));
      }
      if (e.key === STORAGE_KEYS.samples) {
        setSamples(normalizeSamples(safeRead(STORAGE_KEYS.samples, [])));
      }
      if (e.key === STORAGE_KEYS.criticalAlerts) {
        setCriticalAlerts(normalizeCriticalAlerts(safeRead(STORAGE_KEYS.criticalAlerts, [])));
      }
      if (e.key === STORAGE_KEYS.auditLogs) {
        setAuditLogs(normalizeAuditLogs(safeRead(STORAGE_KEYS.auditLogs, [])));
      }
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

  const pendingDoctorAlerts = useMemo(
    () => criticalAlerts.filter((item) => !item.acknowledged),
    [criticalAlerts]
  );

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
      } catch {
        //
      }
    }

    if (session?.role !== "Doctor") return;

    const newUnheardAlerts = pendingDoctorAlerts.filter(
      (item) => !lastPlayedAlertIdsRef.current.includes(item.id)
    );

    if (newUnheardAlerts.length) {
      playCriticalAlertSound();
      lastPlayedAlertIdsRef.current = [
        ...lastPlayedAlertIdsRef.current,
        ...newUnheardAlerts.map((item) => item.id),
      ];
    }
  }, [pendingDoctorAlerts, session]);

  function isDuplicateSample(candidate) {
    const normalizedBarcode = candidate.barcode.trim().toLowerCase();
    const normalizedMrn = candidate.mrn.trim().toLowerCase();
    const normalizedTests = uniqueValues(candidate.tests).sort().join("|");

    return samples.some((sample) => {
      if (sample.cancelled) return false;

      const sameBarcode =
        normalizedBarcode &&
        sample.barcode.trim().toLowerCase() === normalizedBarcode;

      const sameMrnAndTests =
        sample.mrn.trim().toLowerCase() === normalizedMrn &&
        uniqueValues(sample.tests).sort().join("|") === normalizedTests &&
        sample.status !== "Completed";

      return sameBarcode || sameMrnAndTests;
    });
  }

  function isDuplicateResult(candidate) {
    return results.some((item) => {
      if (item.cancelled) return false;

      const sameRequestAndTest =
        candidate.requestId &&
        item.requestId === candidate.requestId &&
        item.test === candidate.test;

      const sameBarcodeMrnTest =
        item.barcode === candidate.barcode &&
        item.mrn === candidate.mrn &&
        item.test === candidate.test &&
        item.status !== "Cancelled";

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
      (emp) =>
        emp.username.toLowerCase() === username &&
        emp.password === password &&
        emp.active
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
    const ok = window.confirm(
      "This will clear all saved downtime data from this browser. Continue?"
    );
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
      {
        id: 1,
        username: "lab",
        password: "1234",
        role: "Lab",
        name: "Laboratory Staff",
        active: true,
      },
      {
        id: 2,
        username: "reception1",
        password: "1234",
        role: "Reception",
        name: "Reception Staff",
        active: true,
      },
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
      "ID",
      "RequestID",
      "Barcode",
      "MRN",
      "Department",
      "Patient",
      "Test",
      "Result",
      "Status",
      "AlertStatus",
      "Synced",
      "Source",
      "Time",
      "CreatedAt",
      "Technician",
      "Note",
      "Comment",
      "Cancelled",
      "CancelledBy",
      "CancelledAt",
      "EditedBy",
      "EditedAt",
    ];

    const rows = results.map((item) => [
      item.id,
      item.requestId,
      item.barcode,
      item.mrn,
      item.department,
      item.patient,
      item.test,
      item.result,
      item.status,
      alertMapByResultId[item.id]
        ? alertMapByResultId[item.id].acknowledged
          ? "Acknowledged"
          : "Pending"
        : item.status === "Critical"
        ? "Pending"
        : "-",
      item.synced ? "Yes" : "No",
      item.source,
      item.time,
      item.createdAt,
      item.technician,
      item.note,
      item.comment,
      item.cancelled ? "Yes" : "No",
      item.cancelledBy,
      item.cancelledAt,
      item.editedBy,
      item.editedAt,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
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

        const validRows = importedRows.filter(
          (row) => row.barcode || row.mrn || row.patient || row.test || row.result
        );

        if (!validRows.length) {
          alert("No valid rows found in the CSV file");
          return;
        }

        const replaceExisting = window.confirm(
          "Do you want to replace existing results?\nPress OK to replace, or Cancel to append."
        );

        if (replaceExisting) {
          setResults(validRows);
        } else {
          setResults((prev) => [...validRows, ...prev]);
        }

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
      const nextTests = exists
        ? prev.tests.filter((t) => t !== test)
        : [...prev.tests, test];

      return {
        ...prev,
        tests: nextTests.length ? nextTests : [test],
      };
    });
  }

  function handleAddSample(e) {
    e.preventDefault();
    if (!canReceiveSamples) return;

    if (
      !sampleForm.barcode ||
      !sampleForm.mrn ||
      !sampleForm.department ||
      !sampleForm.patient ||
      !sampleForm.receivedBy ||
      !sampleForm.tests.length
    ) {
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
    addAuditLog(
      "Sample Received",
      `Barcode ${newSample.barcode} | MRN ${newSample.mrn} | Tests: ${newSample.tests.join(", ")}`
    );

    setSampleForm({
      ...getDefaultSampleForm(),
      receivedBy: session.name,
    });
  }

  function loadSampleToEntry(sample, mode = "manual") {
    if (!canEnterResults) return;

    const remainingTests = getRemainingTestsForSample(sample);
    const selectedTest = remainingTests[0] || sample.tests[0] || "CBC";

    updateSampleStatus(sample.id, { status: "In Progress", inProgress: true });
    addAuditLog(
      "Sample Loaded",
      `Barcode ${sample.barcode} loaded to ${mode} entry for test ${selectedTest}`
    );

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

    addAuditLog(
      "Critical Alert Created",
      `MRN ${resultItem.mrn} | ${resultItem.test} | Result ${resultItem.result}`
    );
  }

  function acknowledgeCriticalAlert(alertId) {
    const alertItem = criticalAlerts.find((item) => item.id === alertId);
    setCriticalAlerts((prev) =>
      prev.map((item) =>
        item.id === alertId
          ? {
              ...item,
              acknowledged: true,
              acknowledgedBy: session?.name || "",
              acknowledgedAt: getNowDateTime(),
            }
          : item
      )
    );

    if (alertItem) {
      addAuditLog(
        "Critical Alert Acknowledged",
        `MRN ${alertItem.mrn} | ${alertItem.test} acknowledged by doctor`
      );
    }
  }

  function registerResultSave(newResult) {
    setResults((prev) => [newResult, ...prev]);

    if (newResult.status === "Critical") {
      createCriticalAlert(newResult);
    }

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

    addAuditLog(
      "Result Saved",
      `MRN ${newResult.mrn} | ${newResult.test} | ${newResult.status}`
    );
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

    setForm({
      ...getDefaultManualForm(),
      technician: session.name,
    });
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

    setExtractedData({
      test: scanForm.test,
      result: singleResult || "",
      cbc: null,
      status,
    });
  }

  function handleScanFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (scanForm.filePreview) {
      URL.revokeObjectURL(scanForm.filePreview);
    }

    const previewUrl = URL.createObjectURL(file);

    setScanForm((prev) => ({
      ...prev,
      fileName: file.name,
      filePreview: previewUrl,
      fileType: file.type,
    }));
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

    setScanForm({
      ...getDefaultScanForm(),
      technician: session.name,
    });
    setExtractedData(null);
  }

  function handleSync(id) {
    if (!canEnterResults) return;

    const target = results.find((item) => item.id === id);
    setResults((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              synced: true,
              note: "Marked for LIS reconciliation",
            }
          : item
      )
    );

    if (target) {
      addAuditLog("Result Marked for LIS Entry", `MRN ${target.mrn} | ${target.test}`);
    }
  }

  function startEditResult(item) {
    setEditingResultId(item.id);
    setEditForm({
      result: item.result,
      comment: item.comment || "",
      time: item.time || "",
      note: item.note || "",
    });
  }

  function saveEditedResult() {
    if (!editingResultId) return;

    const target = results.find((item) => item.id === editingResultId);
    if (!target) return;

    if (!editForm.result.trim()) {
      alert("Result cannot be empty");
      return;
    }

    const updatedResultStatus =
      target.test === "CBC"
        ? target.status
        : getStatus(target.test, editForm.result.trim(), null);

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
        updateSampleStatus(item.requestId, {
          completedTests,
          inProgress: false,
        });
      }
    }

    addAuditLog("Result Cancelled", `MRN ${item.mrn} | ${item.test}`);
  }

  function handleCancelSample(sample) {
    const ok = window.confirm("Cancel this sample request?");
    if (!ok) return;

    updateSampleStatus(sample.id, {
      cancelled: true,
      status: "Cancelled",
      inProgress: false,
    });

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
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: #f8fafc;
              color: #0f172a;
            }
            .label {
              width: 440px;
              border: 2px solid #0f172a;
              border-radius: 18px;
              background: #fff;
              padding: 18px;
              margin: 0 auto;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              margin-bottom: 10px;
            }
            .hospital {
              font-size: 12px;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 1px;
            }
            .title {
              font-size: 22px;
              font-weight: bold;
              margin-top: 6px;
            }
            .barcode-box {
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              padding: 12px;
              background: #fff;
              text-align: center;
              margin: 14px 0 16px;
            }
            .info-row {
              margin-bottom: 10px;
              font-size: 15px;
            }
            .label-text {
              font-weight: bold;
              color: #475569;
            }
            @media print {
              body {
                background: #fff;
                padding: 0;
              }
              .label {
                border: 1px solid #000;
                border-radius: 0;
                width: 100%;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              <div class="hospital">${escapeHtml(HOSPITAL_NAME)}</div>
              <div class="title">Sample Barcode Label</div>
            </div>

            <div class="barcode-box">
              ${barcodeSvg}
            </div>

            <div class="info-row"><span class="label-text">Patient:</span> ${escapeHtml(sample.patient || "-")}</div>
            <div class="info-row"><span class="label-text">MRN:</span> ${escapeHtml(sample.mrn || "-")}</div>
            <div class="info-row"><span class="label-text">Department:</span> ${escapeHtml(sample.department || "-")}</div>
            <div class="info-row"><span class="label-text">Barcode:</span> ${escapeHtml(sample.barcode || "-")}</div>
            <div class="info-row"><span class="label-text">Requested Tests:</span> ${escapeHtml((sample.tests || []).join(", ") || "-")}</div>
            <div class="info-row"><span class="label-text">Status:</span> ${escapeHtml(sample.status || "-")}</div>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
    addAuditLog("Barcode Printed", `Barcode ${sample.barcode} | MRN ${sample.mrn}`);
  }

  function handlePrintResult(item) {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;

    const alertStatus =
      alertMapByResultId[item.id]
        ? alertMapByResultId[item.id].acknowledged
          ? "Acknowledged"
          : "Pending"
        : item.status === "Critical"
        ? "Pending"
        : "-";

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
            <p><span class="label">Technician:</span> ${escapeHtml(item.technician)}</p>
            <p><span class="label">Source:</span> ${escapeHtml(item.source)}</p>
            <p><span class="label">Note:</span> ${escapeHtml(item.note)}</p>
            <p><span class="label">Comment:</span> ${escapeHtml(item.comment || "-")}</p>
          </div>
          <p class="note">Pending official LIS verification if not yet synchronized.</p>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.print();
  }

  function handleAddEmployee(e) {
    e.preventDefault();
    if (session?.role !== "Admin") return;

    const name = employeeForm.name.trim();
    const username = employeeForm.username.trim().toLowerCase();
    const password = employeeForm.password.trim();
    const role = employeeForm.role;

    if (!name || !username || !password || !role) {
      alert("Please fill all employee fields");
      return;
    }

    const usernameExistsInFixedUsers = !!fixedUsers[username];
    const usernameExistsInEmployees = employees.some(
      (emp) => emp.username.toLowerCase() === username
    );

    if (usernameExistsInFixedUsers || usernameExistsInEmployees) {
      alert("Username already exists");
      return;
    }

    const newEmployee = {
      id: Date.now(),
      name,
      username,
      password,
      role,
      active: true,
    };

    setEmployees((prev) => [...prev, newEmployee]);
    setEmployeeForm({ name: "", username: "", password: "", role: "Lab" });
    addAuditLog("Employee Added", `${name} (${role})`);
  }

  function handleToggleEmployee(id) {
    if (session?.role !== "Admin") return;
    const target = employees.find((emp) => emp.id === id);

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === id ? { ...emp, active: !emp.active } : emp
      )
    );

    if (target) {
      addAuditLog(
        target.active ? "Employee Disabled" : "Employee Enabled",
        `${target.name} (${target.username})`
      );
    }
  }

  function handleDeleteEmployee(id) {
    if (session?.role !== "Admin") return;
    const target = employees.find((emp) => emp.id === id);
    const ok = window.confirm("Delete this employee?");
    if (!ok) return;

    setEmployees((prev) => prev.filter((emp) => emp.id !== id));

    if (target) {
      addAuditLog("Employee Deleted", `${target.name} (${target.username})`);
    }
  }

  function handleResetEmployeePassword(id) {
    if (session?.role !== "Admin") return;

    const target = employees.find((emp) => emp.id === id);
    const newPassword = window.prompt("Enter new password:");
    if (!newPassword) return;

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === id ? { ...emp, password: newPassword } : emp
      )
    );

    if (target) {
      addAuditLog("Employee Password Reset", `${target.name} (${target.username})`);
    }
  }

  const activeSamples = useMemo(
    () => samples.filter((item) => item.status !== "Completed" && item.status !== "Cancelled"),
    [samples]
  );

  const filteredResults = useMemo(() => {
    const q = search.toLowerCase().trim();

    let list = [...results];

    if (session?.role === "Doctor") {
      if (!q) return [];
      list = list.filter((item) => item.mrn.toLowerCase().includes(q));
    } else if (q) {
      list = list.filter((item) =>
        [
          item.barcode,
          item.mrn,
          item.department,
          item.patient,
          item.test,
          item.result,
          item.status,
          item.technician,
          item.source,
          item.createdAt,
          item.comment,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.department) {
      list = list.filter((item) => item.department === filters.department);
    }
    if (filters.test) {
      list = list.filter((item) => item.test === filters.test);
    }
    if (filters.resultStatus) {
      list = list.filter((item) => item.status === filters.resultStatus);
    }
    if (filters.syncStatus) {
      list = list.filter((item) =>
        filters.syncStatus === "Synced" ? item.synced : !item.synced
      );
    }
    if (filters.alertStatus) {
      list = list.filter((item) => {
        const alert = alertMapByResultId[item.id];
        const current =
          alert
            ? alert.acknowledged
              ? "Acknowledged"
              : "Pending"
            : item.status === "Critical"
            ? "Pending"
            : "None";
        return current === filters.alertStatus;
      });
    }

    return list;
  }, [results, search, session, filters, alertMapByResultId]);

  const filteredSamples = useMemo(() => {
    let list = [...samples];
    if (filters.department) {
      list = list.filter((item) => item.department === filters.department);
    }
    if (filters.sampleStatus) {
      list = list.filter((item) => item.status === filters.sampleStatus);
    }
    if (filters.test) {
      list = list.filter((item) => item.tests.includes(filters.test));
    }
    return list;
  }, [samples, filters]);

  const criticalCount = results.filter((r) => r.status === "Critical" && !r.cancelled).length;
  const pendingSyncCount = results.filter((r) => !r.synced && !r.cancelled).length;
  const pendingDoctorAlertsCount = pendingDoctorAlerts.length;
  const completedSamplesCount = samples.filter((s) => s.status === "Completed").length;
  const activeSamplesCount = samples.filter(
    (s) => s.status !== "Completed" && s.status !== "Cancelled"
  ).length;
  const auditLogsPreview = auditLogs.slice(0, 12);

  function badgeStyle(status) {
    if (status === "Critical") {
      return {
        background: "#fee2e2",
        color: "#b91c1c",
        border: "1px solid #fecaca",
      };
    }
    if (status === "Review") {
      return {
        background: "#fef3c7",
        color: "#b45309",
        border: "1px solid #fde68a",
      };
    }
    if (status === "Cancelled") {
      return {
        background: "#e2e8f0",
        color: "#334155",
        border: "1px solid #cbd5e1",
      };
    }
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  function syncBadgeStyle(value) {
    return value
      ? {
          background: "#dbeafe",
          color: "#1d4ed8",
          border: "1px solid #bfdbfe",
        }
      : {
          background: "#fff7ed",
          color: "#c2410c",
          border: "1px solid #fed7aa",
        };
  }

  function sampleStatusStyle(status) {
    if (status === "Received") return badgeStyle("Review");
    if (status === "In Progress") return syncBadgeStyle(false);
    if (status === "Partial Completed") return {
      background: "#ede9fe",
      color: "#6d28d9",
      border: "1px solid #ddd6fe",
    };
    if (status === "Completed") return badgeStyle("Normal");
    return badgeStyle("Cancelled");
  }

  if (!session) {
    return (
      <div style={loginPageStyle}>
        <div style={loginCardStyle}>
          <div style={loginHeaderStyle}>
            <div style={{ flex: 1 }}>
              <div style={loginHospitalNameStyle}>{HOSPITAL_NAME}</div>
              <h1 style={loginTitleStyle}>{SYSTEM_NAME}</h1>
              <p style={loginSubtitleStyle}>
                Prototype access for downtime result handling during LIS maintenance.
              </p>
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
              <input
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                style={inputStyle}
                placeholder="admin, doctor, or lab"
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label>Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                style={inputStyle}
                placeholder="Enter password"
              />
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
      <div style={{ maxWidth: "1550px", margin: "0 auto" }}>
        {session.role === "Doctor" && pendingDoctorAlertsCount > 0 && (
          <div style={criticalAlertOverlayStyle}>
            <div style={criticalAlertBoxStyle}>
              <div style={criticalAlertHeaderStyle}>
                <div>
                  <div style={criticalAlertTitleStyle}>Critical Results Alerts</div>
                  <div style={{ color: "#475569", marginTop: 4 }}>
                    Please review and acknowledge the following critical results.
                  </div>
                </div>
                <div style={criticalAlertCounterStyle}>
                  {pendingDoctorAlertsCount} alert{pendingDoctorAlertsCount > 1 ? "s" : ""}
                </div>
              </div>

              <div style={criticalAlertListStyle}>
                {pendingDoctorAlerts.map((alertItem) => (
                  <div key={alertItem.id} style={criticalAlertItemStyle}>
                    <div style={criticalAlertItemTopStyle}>
                      <div style={{ fontWeight: "bold", color: "#7f1d1d", fontSize: 18 }}>
                        نتيجة حرجة للمريض رقم {alertItem.mrn}
                      </div>
                      <button
                        type="button"
                        style={smallButtonOrange}
                        onClick={() => acknowledgeCriticalAlert(alertItem.id)}
                      >
                        تم الاطلاع
                      </button>
                    </div>

                    <div style={criticalAlertDetailsStyle}>
                      <div><strong>MRN:</strong> {alertItem.mrn}</div>
                      <div><strong>Patient:</strong> {alertItem.patient || "-"}</div>
                      <div><strong>Test:</strong> {alertItem.test}</div>
                      <div><strong>Result:</strong> {alertItem.result}</div>
                      <div><strong>Time:</strong> {alertItem.createdAt || "-"}</div>
                      <div><strong>Comment:</strong> {alertItem.comment || "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={topBannerStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={topHospitalNameStyle}>{HOSPITAL_NAME}</div>
              <h1 style={topSystemNameStyle}>{SYSTEM_NAME}</h1>
              <div style={topSubTextStyle}>
                Prototype workflow for temporary reporting during LIS downtime
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
              <div style={statusPillStyle}>LIS Status: Scheduled Maintenance Window</div>
              <div style={loggedUserStyle}>
                Logged in as <strong>{session.name}</strong> ({session.role})
              </div>
            </div>
          </div>

          <div style={headerButtonsRowStyle}>
            <button type="button" onClick={handleExportCSV} style={smallButtonGreen}>Export CSV</button>
            <button type="button" onClick={openImportDialog} style={smallButtonPurple}>Import CSV</button>
            <button type="button" onClick={resetAllSavedData} style={smallButtonOrange}>Reset Saved Data</button>
            <button type="button" onClick={handleLogout} style={smallButtonGray}>Logout</button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: "none" }}
            />
          </div>
        </div>

        {(session.role === "Admin" || canViewResultsPanel) && (
          <div style={{ ...panelStyle, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ marginTop: 0, marginBottom: 6 }}>
                  {session.role === "Admin" ? "Admin Dashboard" : "Filters & Overview"}
                </h2>
                <p style={{ color: "#64748b", margin: 0 }}>
                  Quick monitoring cards and advanced filters.
                </p>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, width: 300, marginBottom: 0 }}
                placeholder={
                  session.role === "Doctor"
                    ? "Search by patient MRN only..."
                    : "Search by barcode, MRN, patient, test..."
                }
              />
            </div>

            <div style={dashboardGridStyle}>
              <div style={cardStyle}>
                <div style={metricLabelStyle}>Total Samples</div>
                <div style={metricValueStyle}>{samples.length}</div>
              </div>
              <div style={cardStyle}>
                <div style={metricLabelStyle}>Active Samples</div>
                <div style={metricValueStyle}>{activeSamplesCount}</div>
              </div>
              <div style={cardStyle}>
                <div style={metricLabelStyle}>Completed Samples</div>
                <div style={metricValueStyle}>{completedSamplesCount}</div>
              </div>
              <div style={{ ...cardStyle, background: "#fef2f2", border: "1px solid #fecaca" }}>
                <div style={{ ...metricLabelStyle, color: "#b91c1c" }}>Critical Results</div>
                <div style={{ ...metricValueStyle, color: "#b91c1c" }}>{criticalCount}</div>
              </div>
              <div style={{ ...cardStyle, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div style={{ ...metricLabelStyle, color: "#1d4ed8" }}>Pending Reconciliation</div>
                <div style={{ ...metricValueStyle, color: "#1d4ed8" }}>{pendingSyncCount}</div>
              </div>
              <div style={{ ...cardStyle, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                <div style={{ ...metricLabelStyle, color: "#c2410c" }}>Pending Doctor Alerts</div>
                <div style={{ ...metricValueStyle, color: "#c2410c" }}>{pendingDoctorAlertsCount}</div>
              </div>
            </div>

            <div style={filtersGridStyle}>
              <div>
                <label>Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">All</option>
                  {DEPARTMENT_OPTIONS.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Test</label>
                <select
                  value={filters.test}
                  onChange={(e) => setFilters((prev) => ({ ...prev, test: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">All</option>
                  {TEST_OPTIONS.map((test) => (
                    <option key={test} value={test}>{test}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Result Status</label>
                <select
                  value={filters.resultStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, resultStatus: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">All</option>
                  {RESULT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Sync</label>
                <select
                  value={filters.syncStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, syncStatus: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">All</option>
                  <option value="Synced">Synced</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label>Alert Status</label>
                <select
                  value={filters.alertStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, alertStatus: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Acknowledged">Acknowledged</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div>
                <label>Sample Status</label>
                <select
                  value={filters.sampleStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sampleStatus: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">All</option>
                  {SAMPLE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: canEnterResults || session.role === "Admin" ? "1.2fr 2fr" : "1fr",
            gap: "24px",
          }}
        >
          {session.role === "Admin" && (
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Admin Panel</h2>
              <p style={{ color: "#64748b" }}>
                Manage employees and review recent system activity.
              </p>

              <form onSubmit={handleAddEmployee}>
                <div style={{ marginBottom: "12px" }}>
                  <label>Employee Name</label>
                  <input
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    style={inputStyle}
                    placeholder="Employee full name"
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label>Username</label>
                  <input
                    value={employeeForm.username}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, username: e.target.value })}
                    style={inputStyle}
                    placeholder="Username"
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label>Password</label>
                  <input
                    value={employeeForm.password}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                    style={inputStyle}
                    placeholder="Password"
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label>Role</label>
                  <select
                    value={employeeForm.role}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="Lab">Lab</option>
                    <option value="Reception">Reception</option>
                    <option value="All">All Access</option>
                  </select>
                </div>

                <button type="submit" style={buttonStyleInline}>Add Employee</button>
              </form>

              <div style={{ marginTop: 24 }}>
                <h3>Employees</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Username</th>
                        <th style={thStyle}>Role</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id}>
                          <td style={tdStyle}>{emp.name}</td>
                          <td style={tdStyle}>{emp.username}</td>
                          <td style={tdStyle}>{emp.role}</td>
                          <td style={tdStyle}>
                            <span style={{ ...syncBadgeStyle(emp.active), borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>
                              {emp.active ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" style={smallButtonBlue} onClick={() => handleToggleEmployee(emp.id)}>
                                {emp.active ? "Disable" : "Enable"}
                              </button>
                              <button type="button" style={smallButtonPurple} onClick={() => handleResetEmployeePassword(emp.id)}>
                                Reset Password
                              </button>
                              <button type="button" style={smallButtonOrange} onClick={() => handleDeleteEmployee(emp.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <h3>Recent Audit Trail</h3>
                {auditLogsPreview.length === 0 ? (
                  <div style={infoBoxStyle}>No activity yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {auditLogsPreview.map((log) => (
                      <div key={log.id} style={auditCardStyle}>
                        <div style={{ fontWeight: "bold" }}>{log.action}</div>
                        <div style={{ color: "#475569", marginTop: 4 }}>{log.details}</div>
                        <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
                          {log.actor} ({log.role}) • {log.createdAt}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {canReceiveSamples && (
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Sample Reception Entry</h2>
              <p style={{ color: "#64748b" }}>
                Register the patient and requested tests. Multiple tests can be selected for the same request.
              </p>

              <form onSubmit={handleAddSample}>
                <div style={{ marginBottom: 12 }}>
                  <label>Barcode</label>
                  <input
                    value={sampleForm.barcode}
                    onChange={(e) => setSampleForm({ ...sampleForm, barcode: e.target.value })}
                    style={inputStyle}
                    placeholder="Scan barcode"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label>MRN</label>
                  <input
                    value={sampleForm.mrn}
                    onChange={(e) => setSampleForm({ ...sampleForm, mrn: e.target.value })}
                    style={inputStyle}
                    placeholder="Patient MRN"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label>Department</label>
                  <select
                    value={sampleForm.department}
                    onChange={(e) => setSampleForm({ ...sampleForm, department: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select department</option>
                    {DEPARTMENT_OPTIONS.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label>Patient Name</label>
                  <input
                    value={sampleForm.patient}
                    onChange={(e) => setSampleForm({ ...sampleForm, patient: e.target.value })}
                    style={inputStyle}
                    placeholder="Patient name"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label>Requested Tests</label>
                  <div style={checkboxGridStyle}>
                    {TEST_OPTIONS.map((test) => (
                      <label key={test} style={checkboxItemStyle}>
                        <input
                          type="checkbox"
                          checked={sampleForm.tests.includes(test)}
                          onChange={() => toggleSampleTest(test)}
                        />
                        <span>{test}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label>Received Time</label>
                  <input
                    value={sampleForm.time}
                    onChange={(e) => setSampleForm({ ...sampleForm, time: e.target.value })}
                    style={inputStyle}
                    placeholder="10:45"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label>Received By</label>
                  <input
                    value={sampleForm.receivedBy}
                    onChange={(e) => setSampleForm({ ...sampleForm, receivedBy: e.target.value })}
                    style={inputStyle}
                    placeholder="Reception staff name"
                  />
                </div>

                <button type="submit" style={buttonStyle}>Save Sample Request</button>
              </form>

              <div style={{ marginTop: 24 }}>
                <h3 style={{ marginBottom: 12 }}>Samples</h3>
                {filteredSamples.length === 0 ? (
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
                        {filteredSamples.map((sample) => (
                          <tr key={sample.id}>
                            <td style={tdStyle}>{sample.barcode}</td>
                            <td style={tdStyle}>{sample.mrn}</td>
                            <td style={tdStyle}>{sample.department || "-"}</td>
                            <td style={tdStyle}>{sample.patient}</td>
                            <td style={tdStyle}>{sample.tests.join(", ")}</td>
                            <td style={tdStyle}>
                              <span style={{ ...sampleStatusStyle(sample.status), borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>
                                {sample.status}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button type="button" style={smallButtonBlue} onClick={() => handlePrintSampleBarcode(sample)}>
                                  Print Barcode
                                </button>
                                {sample.status !== "Completed" && sample.status !== "Cancelled" && (
                                  <button type="button" style={smallButtonOrange} onClick={() => handleCancelSample(sample)}>
                                    Cancel Sample
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {canEnterResults && (
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Lab Entry</h2>
              <p style={{ color: "#64748b" }}>
                Complete results for incoming samples or enter a new result manually.
              </p>

              <div style={{ ...infoBoxStyle, marginBottom: 18 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8 }}>Pending Samples</div>
                {activeSamples.length === 0 ? (
                  <div style={{ color: "#64748b" }}>No active samples.</div>
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
                          <th style={thStyle}>Remaining</th>
                          <th style={thStyle}>Status</th>
                          <th style={thStyle}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSamples.map((sample) => (
                          <tr key={sample.id}>
                            <td style={tdStyle}>{sample.barcode}</td>
                            <td style={tdStyle}>{sample.mrn}</td>
                            <td style={tdStyle}>{sample.department || "-"}</td>
                            <td style={tdStyle}>{sample.patient}</td>
                            <td style={tdStyle}>{sample.tests.join(", ")}</td>
                            <td style={tdStyle}>{getRemainingTestsForSample(sample).join(", ") || "-"}</td>
                            <td style={tdStyle}>
                              <span style={{ ...sampleStatusStyle(sample.status), borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>
                                {sample.status}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button type="button" style={smallButtonBlue} onClick={() => loadSampleToEntry(sample, "manual")}>
                                  Load to Manual
                                </button>
                                <button type="button" style={smallButtonPurple} onClick={() => loadSampleToEntry(sample, "scan")}>
                                  Load to Scan
                                </button>
                                <button type="button" style={smallButtonGreen} onClick={() => handlePrintSampleBarcode(sample)}>
                                  Print Barcode
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <button type="button" onClick={() => setEntryMode("manual")} style={entryMode === "manual" ? activeTabStyle : inactiveTabStyle}>
                  Manual Entry
                </button>
                <button type="button" onClick={() => setEntryMode("scan")} style={entryMode === "scan" ? activeTabStyle : inactiveTabStyle}>
                  Scan Result Sheet
                </button>
              </div>

              {entryMode === "manual" ? (
                <form onSubmit={handleAddResult}>
                  {form.requestId && (
                    <div style={{ ...reviewCardStyle, marginBottom: 16 }}>
                      Loaded sample from reception. Saving a result will update the sample status instead of deleting the request.
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <label>Barcode</label>
                    <input
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      style={inputStyle}
                      placeholder="Scan barcode"
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>MRN</label>
                    <input
                      value={form.mrn}
                      onChange={(e) => setForm({ ...form, mrn: e.target.value })}
                      style={inputStyle}
                      placeholder="Patient MRN"
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Department</label>
                    <select
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Select department</option>
                      {DEPARTMENT_OPTIONS.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Patient Name</label>
                    <input
                      value={form.patient}
                      onChange={(e) => setForm({ ...form, patient: e.target.value })}
                      style={inputStyle}
                      placeholder="Patient name"
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Test</label>
                    <select
                      value={form.test}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          test: e.target.value,
                          result: "",
                          cbc: { wbc: "", rbc: "", hb: "", platelets: "" },
                        })
                      }
                      style={inputStyle}
                    >
                      {(form.requestId
                        ? getRemainingTestsForSample(samples.find((s) => s.id === form.requestId) || { tests: TEST_OPTIONS, completedTests: [] })
                        : TEST_OPTIONS
                      ).map((test) => (
                        <option key={test} value={test}>{test}</option>
                      ))}
                    </select>
                  </div>

                  {form.test === "CBC" ? (
                    <div style={{ marginBottom: 12 }}>
                      <label>CBC Panel</label>
                      <input value={form.cbc.wbc} onChange={(e) => setForm({ ...form, cbc: { ...form.cbc, wbc: e.target.value } })} style={inputStyle} placeholder="WBC" />
                      <input value={form.cbc.rbc} onChange={(e) => setForm({ ...form, cbc: { ...form.cbc, rbc: e.target.value } })} style={{ ...inputStyle, marginTop: 10 }} placeholder="RBC" />
                      <input value={form.cbc.hb} onChange={(e) => setForm({ ...form, cbc: { ...form.cbc, hb: e.target.value } })} style={{ ...inputStyle, marginTop: 10 }} placeholder="Hb" />
                      <input value={form.cbc.platelets} onChange={(e) => setForm({ ...form, cbc: { ...form.cbc, platelets: e.target.value } })} style={{ ...inputStyle, marginTop: 10 }} placeholder="Platelets" />
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12 }}>
                      <label>Result</label>
                      <input
                        value={form.result}
                        onChange={(e) => setForm({ ...form, result: e.target.value })}
                        style={inputStyle}
                        placeholder="Enter result"
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <label>Time</label>
                    <input
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      style={inputStyle}
                      placeholder="10:45"
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Technician Name</label>
                    <input
                      value={form.technician}
                      onChange={(e) => setForm({ ...form, technician: e.target.value })}
                      style={inputStyle}
                      placeholder="Technician name"
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label>Comment / Note (Optional)</label>
                    <textarea
                      value={form.comment}
                      onChange={(e) => setForm({ ...form, comment: e.target.value })}
                      style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                      placeholder="Add optional comment for the doctor or record..."
                    />
                  </div>

                  <button type="submit" style={buttonStyle}>Save Manual Result</button>
                </form>
              ) : (
                <div>
                  {scanForm.requestId && (
                    <div style={{ ...reviewCardStyle, marginBottom: 16 }}>
                      Loaded sample from reception. Saving the scanned result will update the sample status.
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <label>Barcode</label>
                    <input value={scanForm.barcode} onChange={(e) => setScanForm({ ...scanForm, barcode: e.target.value })} style={inputStyle} placeholder="Scan barcode" />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>MRN</label>
                    <input value={scanForm.mrn} onChange={(e) => setScanForm({ ...scanForm, mrn: e.target.value })} style={inputStyle} placeholder="Patient MRN" />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Department</label>
                    <select value={scanForm.department} onChange={(e) => setScanForm({ ...scanForm, department: e.target.value })} style={inputStyle}>
                      <option value="">Select department</option>
                      {DEPARTMENT_OPTIONS.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Patient Name</label>
                    <input value={scanForm.patient} onChange={(e) => setScanForm({ ...scanForm, patient: e.target.value })} style={inputStyle} placeholder="Patient name" />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Test</label>
                    <select
                      value={scanForm.test}
                      onChange={(e) => {
                        setScanForm({ ...scanForm, test: e.target.value });
                        setExtractedData(null);
                      }}
                      style={inputStyle}
                    >
                      {(scanForm.requestId
                        ? getRemainingTestsForSample(samples.find((s) => s.id === scanForm.requestId) || { tests: TEST_OPTIONS, completedTests: [] })
                        : TEST_OPTIONS
                      ).map((test) => (
                        <option key={test} value={test}>{test}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Upload Result Sheet</label>
                    <input type="file" accept="image/*,.pdf" onChange={handleScanFileChange} style={inputStyle} />
                  </div>

                  {scanForm.fileName && (
                    <div style={infoBoxStyle}>
                      <div><strong>Selected file:</strong> {scanForm.fileName}</div>
                    </div>
                  )}

                  {scanForm.filePreview && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ marginBottom: 8, fontWeight: "bold" }}>Preview</div>
                      {scanForm.fileType === "application/pdf" ? (
                        <iframe
                          src={scanForm.filePreview}
                          title="Uploaded PDF preview"
                          style={{ width: "100%", height: 320, border: "1px solid #cbd5e1", borderRadius: 12, background: "#fff" }}
                        />
                      ) : (
                        <img
                          src={scanForm.filePreview}
                          alt="Uploaded result sheet preview"
                          style={{ width: "100%", maxHeight: 220, objectFit: "contain", border: "1px solid #cbd5e1", borderRadius: 12, background: "#fff" }}
                        />
                      )}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <label>OCR Text</label>
                    <textarea
                      value={scanForm.ocrText}
                      onChange={(e) => setScanForm({ ...scanForm, ocrText: e.target.value })}
                      style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                      placeholder="Paste OCR output here, e.g. WBC 8.5 RBC 4.7 HB 13.2 Platelets 220"
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Time</label>
                    <input value={scanForm.time} onChange={(e) => setScanForm({ ...scanForm, time: e.target.value })} style={inputStyle} placeholder="10:45" />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Technician Name</label>
                    <input value={scanForm.technician} onChange={(e) => setScanForm({ ...scanForm, technician: e.target.value })} style={inputStyle} placeholder="Technician name" />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label>Comment / Note (Optional)</label>
                    <textarea
                      value={scanForm.comment}
                      onChange={(e) => setScanForm({ ...scanForm, comment: e.target.value })}
                      style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                      placeholder="Add optional comment for the doctor or record..."
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <button type="button" onClick={extractFromOCR} style={smallButtonBlue}>Extract Results</button>
                    <button type="button" onClick={handleSaveScannedResult} style={buttonStyleInline}>Confirm & Save</button>
                  </div>

                  {extractedData && (
                    <div style={reviewCardStyle}>
                      <div style={{ fontWeight: "bold", marginBottom: 10 }}>Extracted Results Review</div>
                      <div style={{ marginBottom: 8 }}><strong>Test:</strong> {extractedData.test}</div>
                      <div style={{ marginBottom: 8 }}><strong>Result:</strong> {extractedData.result}</div>
                      <div>
                        <strong>Status:</strong>{" "}
                        <span style={{ ...badgeStyle(extractedData.status), borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>
                          {extractedData.status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {canViewResultsPanel && (
            <div style={panelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: 6 }}>
                    {session.role === "Doctor"
                      ? "Doctor Portal"
                      : session.role === "Admin"
                      ? "System Overview"
                      : "Results View"}
                  </h2>
                  <p style={{ color: "#64748b", margin: 0 }}>
                    {session.role === "Doctor"
                      ? "Search by patient MRN to view results"
                      : "Review downtime results with alert status, comments, and actions."}
                  </p>
                </div>
              </div>

              {session.role === "Doctor" && !search.trim() && (
                <div style={{ marginTop: 20, marginBottom: 16, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 16, padding: 16, color: "#9a3412", fontWeight: "bold" }}>
                  Please enter the patient MRN to view results.
                </div>
              )}

              {session.role === "Doctor" && search.trim() && filteredResults.length === 0 && (
                <div style={{ marginTop: 20, marginBottom: 16, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 16, padding: 16, color: "#475569", fontWeight: "bold" }}>
                  No results found for this MRN.
                </div>
              )}

              {session.role === "Doctor" && !search.trim() ? null : (
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
                        <th style={thStyle}>Source</th>
                        <th style={thStyle}>Time</th>
                        <th style={thStyle}>Created At</th>
                        <th style={thStyle}>Technician</th>
                        <th style={thStyle}>Note</th>
                        <th style={thStyle}>Comment</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((item) => {
                        const alertItem = alertMapByResultId[item.id];
                        const alertStatus =
                          alertItem
                            ? alertItem.acknowledged
                              ? "Acknowledged"
                              : "Pending"
                            : item.status === "Critical"
                            ? "Pending"
                            : "None";

                        return (
                          <tr key={item.id} style={item.status === "Critical" ? criticalRowStyle : undefined}>
                            <td style={tdStyle}>{item.barcode}</td>
                            <td style={tdStyle}>{item.mrn}</td>
                            <td style={tdStyle}>{item.department || "-"}</td>
                            <td style={tdStyle}>{item.patient}</td>
                            <td style={tdStyle}>{item.test}</td>
                            <td style={tdStyle}>{item.result}</td>
                            <td style={tdStyle}>
                              <span style={{ ...badgeStyle(item.status), borderRadius: "999px", padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>
                                {item.status}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <span
                                style={{
                                  ...(
                                    alertStatus === "Pending"
                                      ? badgeStyle("Critical")
                                      : alertStatus === "Acknowledged"
                                      ? syncBadgeStyle(true)
                                      : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }
                                  ),
                                  borderRadius: 999,
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  display: "inline-block",
                                }}
                              >
                                {alertStatus}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ ...syncBadgeStyle(item.synced), borderRadius: "999px", padding: "6px 12px", fontSize: 12, fontWeight: "bold", display: "inline-block" }}>
                                {item.synced ? "Synced" : "Pending"}
                              </span>
                            </td>
                            <td style={tdStyle}>{item.source}</td>
                            <td style={tdStyle}>{item.time}</td>
                            <td style={tdStyle}>{item.createdAt || "-"}</td>
                            <td style={tdStyle}>{item.technician}</td>
                            <td style={tdStyle}>{item.note}</td>
                            <td style={tdStyle}>{item.comment || "-"}</td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {canEnterResults && !item.synced && !item.cancelled && (
                                  <button type="button" style={smallButtonBlue} onClick={() => handleSync(item.id)}>
                                    Mark for LIS Entry
                                  </button>
                                )}
                                <button type="button" style={smallButtonGray} onClick={() => handlePrintResult(item)}>
                                  Print
                                </button>
                                {canManageResults && !item.cancelled && (
                                  <>
                                    <button type="button" style={smallButtonPurple} onClick={() => startEditResult(item)}>
                                      Edit
                                    </button>
                                    <button type="button" style={smallButtonOrange} onClick={() => handleCancelResult(item)}>
                                      Cancel
                                    </button>
                                  </>
                                )}
                                {session.role === "Doctor" && alertItem && !alertItem.acknowledged && (
                                  <button type="button" style={smallButtonOrange} onClick={() => acknowledgeCriticalAlert(alertItem.id)}>
                                    تم الاطلاع
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {editingResultId && (
                <div style={editBoxStyle}>
                  <h3 style={{ marginTop: 0 }}>Edit Result</h3>
                  <div style={{ marginBottom: 12 }}>
                    <label>Result</label>
                    <textarea
                      value={editForm.result}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, result: e.target.value }))}
                      style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label>Comment</label>
                    <textarea
                      value={editForm.comment}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, comment: e.target.value }))}
                      style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label>Time</label>
                    <input
                      value={editForm.time}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, time: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label>Note</label>
                    <input
                      value={editForm.note}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" style={smallButtonGreen} onClick={saveEditedResult}>
                      Save Edit
                    </button>
                    <button type="button" style={smallButtonGray} onClick={() => setEditingResultId("")}>
                      Close
                    </button>
                  </div>
                </div>
              )}

              <div style={aiNoteStyle}>
                <strong>Prototype Notice:</strong> downtime work is saved locally in this browser, supports audit trail,
                barcode printing, multi-test sample requests, and doctor alert acknowledgment. This demo does not connect
                directly to the live LIS.
              </div>
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

const activeTabStyle = {
  padding: "10px 14px",
  background: "#0f172a",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
};

const inactiveTabStyle = {
  padding: "10px 14px",
  background: "#e2e8f0",
  color: "#0f172a",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
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

const auditCardStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
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
ping stat aplication with port to host ping
