import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEYS = {
  session: "lab_portal_session",
  results: "lab_portal_results",
  entryMode: "lab_portal_entry_mode",
  form: "lab_portal_manual_form",
  scanForm: "lab_portal_scan_form",
  extractedData: "lab_portal_extracted_data",
};

const HOSPITAL_NAME = "King Salman Armed Forces Hospital";
const SYSTEM_NAME = "Zero Downtime Lab Portal";

const defaultResults = [
  {
    barcode: "LIS-001",
    mrn: "MRN-102344",
    patient: "Ahmed",
    test: "Potassium",
    result: "6.5",
    status: "Critical",
    time: "10:32",
    note: "Issued during LIS downtime",
    technician: "Fatimah",
    synced: false,
    source: "Manual Entry",
  },
  {
    barcode: "LIS-002",
    mrn: "MRN-102355",
    patient: "Sara",
    test: "CBC",
    result: "WBC: 8.5 | RBC: 4.7 | Hb: 13.2 | Platelets: 220",
    status: "Normal",
    time: "10:38",
    note: "Pending LIS sync",
    technician: "Mona",
    synced: false,
    source: "Scanned Sheet",
  },
];

const users = {
  lab: {
    username: "lab",
    password: "1234",
    role: "Lab",
    name: "Laboratory Staff",
  },
  doctor: {
    username: "doctor",
    password: "1234",
    role: "Doctor",
    name: "Duty Doctor",
  },
};

const defaultManualForm = {
  barcode: "",
  mrn: "",
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
};

const defaultScanForm = {
  barcode: "",
  mrn: "",
  patient: "",
  test: "CBC",
  time: "",
  technician: "",
  fileName: "",
  filePreview: "",
  ocrText: "",
};

function safeRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
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

export default function App() {
  const [session, setSession] = useState(() => safeRead(STORAGE_KEYS.session, null));
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [results, setResults] = useState(() => safeRead(STORAGE_KEYS.results, defaultResults));
  const [search, setSearch] = useState("");
  const [entryMode, setEntryMode] = useState(() => safeRead(STORAGE_KEYS.entryMode, "manual"));
  const [form, setForm] = useState(() => safeRead(STORAGE_KEYS.form, defaultManualForm));
  const [scanForm, setScanForm] = useState(() => safeRead(STORAGE_KEYS.scanForm, defaultScanForm));
  const [extractedData, setExtractedData] = useState(() =>
    safeRead(STORAGE_KEYS.extractedData, null)
  );
  const importInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.results, JSON.stringify(results));
  }, [results]);

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
    localStorage.setItem(STORAGE_KEYS.extractedData, JSON.stringify(extractedData));
  }, [extractedData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (session?.role === "Lab") {
      setForm((prev) => ({
        ...prev,
        technician: prev.technician || session.name,
      }));

      setScanForm((prev) => ({
        ...prev,
        technician: prev.technician || session.name,
      }));
    }
  }, [session]);

  function handleLogin(e) {
    e.preventDefault();
    const username = loginForm.username.trim().toLowerCase();
    const user = users[username];

    if (!user || user.password !== loginForm.password) {
      setLoginError("Invalid username or password");
      return;
    }

    setSession(user);
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

    localStorage.removeItem(STORAGE_KEYS.results);
    localStorage.removeItem(STORAGE_KEYS.entryMode);
    localStorage.removeItem(STORAGE_KEYS.form);
    localStorage.removeItem(STORAGE_KEYS.scanForm);
    localStorage.removeItem(STORAGE_KEYS.extractedData);
    localStorage.removeItem(STORAGE_KEYS.session);

    setResults(defaultResults);
    setEntryMode("manual");
    setForm({
      ...defaultManualForm,
      technician: session?.role === "Lab" ? session.name : "",
    });
    setScanForm({
      ...defaultScanForm,
      technician: session?.role === "Lab" ? session.name : "",
    });
    setExtractedData(null);
    setSearch("");
  }

  function handleExportCSV() {
    if (!results.length) {
      alert("No results available to export");
      return;
    }

    const headers = [
      "Barcode",
      "MRN",
      "Patient",
      "Test",
      "Result",
      "Status",
      "Synced",
      "Source",
      "Time",
      "Technician",
      "Note",
    ];

    const rows = results.map((item) => [
      item.barcode,
      item.mrn,
      item.patient,
      item.test,
      item.result,
      item.status,
      item.synced ? "Yes" : "No",
      item.source,
      item.time,
      item.technician,
      item.note,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
      )
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

        const importedRows = lines.slice(1).map((line) => {
          const cols = parseCSVLine(line);

          const row = {};
          headers.forEach((header, index) => {
            row[header] = cols[index] ?? "";
          });

          return {
            barcode: row["barcode"] || "",
            mrn: row["mrn"] || "",
            patient: row["patient"] || "",
            test: row["test"] || "",
            result: row["result"] || "",
            status: row["status"] || "Normal",
            synced: String(row["synced"] || "").toLowerCase() === "yes",
            source: row["source"] || "Imported CSV",
            time: row["time"] || "",
            technician: row["technician"] || "",
            note: row["note"] || "Imported from CSV",
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

        alert(`Imported ${validRows.length} result(s) successfully.`);
      } catch {
        alert("Failed to import CSV file");
      } finally {
        if (importInputRef.current) {
          importInputRef.current.value = "";
        }
      }
    };

    reader.readAsText(file);
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

  function handleAddResult(e) {
    e.preventDefault();

    if (session?.role !== "Lab") return;

    if (!form.barcode || !form.mrn || !form.patient || !form.test || !form.technician) {
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

    const status = getStatus(form.test, form.result, form.cbc);

    let finalResult = form.result;

    if (form.test === "CBC") {
      finalResult = `WBC: ${form.cbc.wbc} | RBC: ${form.cbc.rbc} | Hb: ${form.cbc.hb} | Platelets: ${form.cbc.platelets}`;
    }

    const newResult = {
      barcode: form.barcode,
      mrn: form.mrn,
      patient: form.patient,
      test: form.test,
      result: finalResult,
      time:
        form.time ||
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      status,
      note: "Issued during LIS downtime",
      technician: form.technician,
      synced: false,
      source: "Manual Entry",
    };

    setResults((prev) => [newResult, ...prev]);

    setForm({
      ...defaultManualForm,
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

    const previewUrl = URL.createObjectURL(file);

    setScanForm((prev) => ({
      ...prev,
      fileName: file.name,
      filePreview: previewUrl,
    }));
  }

  function handleSaveScannedResult() {
    if (session?.role !== "Lab") return;

    if (!scanForm.barcode || !scanForm.mrn || !scanForm.patient || !scanForm.test || !scanForm.technician) {
      alert("Please fill all required fields");
      return;
    }

    if (!extractedData) {
      alert("Please extract results first");
      return;
    }

    const newResult = {
      barcode: scanForm.barcode,
      mrn: scanForm.mrn,
      patient: scanForm.patient,
      test: scanForm.test,
      result: extractedData.result,
      time:
        scanForm.time ||
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      status: extractedData.status,
      note: "Extracted from scanned result sheet",
      technician: scanForm.technician,
      synced: false,
      source: "Scanned Sheet",
    };

    setResults((prev) => [newResult, ...prev]);

    setScanForm({
      ...defaultScanForm,
      technician: session.name,
    });

    setExtractedData(null);
  }

  function handleSync(index) {
    if (session?.role !== "Lab") return;

    setResults((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              synced: true,
              note: "Synced to LIS",
            }
          : item
      )
    );
  }

  function handlePrint(item) {
    const reportWindow = window.open("", "_blank");
    reportWindow.document.write(`
      <html>
        <head>
          <title>${SYSTEM_NAME}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #0f172a; }
            h1 { margin: 0 0 8px 0; font-size: 26px; }
            h2 { margin: 0; font-size: 16px; color: #475569; }
            .top { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
            .logo { width: 160px; max-height: 72px; object-fit: contain; }
            .box { border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; margin-top: 20px; }
            .label { color: #475569; font-weight: bold; }
            .note { margin-top: 20px; color: #b45309; }
          </style>
        </head>
        <body>
          <div class="top">
            <img class="logo" src="${window.location.origin}/gov-logos.png" alt="Government Logos" />
            <div>
              <h2>${HOSPITAL_NAME}</h2>
              <h1>${SYSTEM_NAME}</h1>
            </div>
          </div>

          <p>This result was issued during LIS downtime.</p>

          <div class="box">
            <p><span class="label">Barcode:</span> ${item.barcode}</p>
            <p><span class="label">MRN:</span> ${item.mrn}</p>
            <p><span class="label">Patient:</span> ${item.patient}</p>
            <p><span class="label">Test:</span> ${item.test}</p>
            <p><span class="label">Result:</span> ${item.result}</p>
            <p><span class="label">Status:</span> ${item.status}</p>
            <p><span class="label">Time:</span> ${item.time}</p>
            <p><span class="label">Technician:</span> ${item.technician}</p>
            <p><span class="label">Source:</span> ${item.source}</p>
            <p><span class="label">Note:</span> ${item.note}</p>
          </div>

          <p class="note">Pending official LIS verification if not yet synchronized.</p>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.print();
  }

  const filteredResults = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (session?.role === "Doctor") {
      if (!q) return [];
      return results.filter((item) => item.mrn.toLowerCase().includes(q));
    }

    if (!q) return results;

    return results.filter((item) =>
      [
        item.barcode,
        item.mrn,
        item.patient,
        item.test,
        item.result,
        item.status,
        item.technician,
        item.source,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [results, search, session]);

  const criticalCount = results.filter((r) => r.status === "Critical").length;
  const pendingSyncCount = results.filter((r) => !r.synced).length;

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
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  function syncBadgeStyle(synced) {
    return synced
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

  if (!session) {
    return (
      <div style={loginPageStyle}>
        <div style={loginCardStyle}>
          <div style={loginHeaderStyle}>
            <img src="/gov-logos.png" alt="Government Logos" style={loginLogoStyle} />
            <div style={{ flex: 1 }}>
              <div style={loginHospitalNameStyle}>{HOSPITAL_NAME}</div>
              <h1 style={loginTitleStyle}>{SYSTEM_NAME}</h1>
              <p style={loginSubtitleStyle}>
                Secure login for downtime result access during LIS maintenance.
              </p>
            </div>
          </div>

          <div style={demoBoxStyle}>
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>Demo Accounts</div>
            <div>Lab: <strong>lab</strong> / 1234</div>
            <div>Doctor: <strong>doctor</strong> / 1234</div>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label>Username</label>
              <input
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                style={inputStyle}
                placeholder="lab or doctor"
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
      <div style={{ maxWidth: "1450px", margin: "0 auto" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
              <div style={topLogoBoxStyle}>
                <img src="/gov-logos.png" alt="Government Logos" style={topLogoStyle} />
              </div>

              <div>
                <div style={topHospitalNameStyle}>{HOSPITAL_NAME}</div>
                <h1 style={topSystemNameStyle}>{SYSTEM_NAME}</h1>
                <div style={topSubTextStyle}>
                  Secure temporary reporting and physician access during LIS downtime
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
              <div style={statusPillStyle}>LIS Status: Scheduled Maintenance</div>
              <div style={loggedUserStyle}>
                Logged in as <strong>{session.name}</strong> ({session.role})
              </div>
            </div>
          </div>

          <div style={headerButtonsRowStyle}>
            <button onClick={handleExportCSV} style={smallButtonGreen}>Export CSV</button>
            <button onClick={openImportDialog} style={smallButtonPurple}>Import CSV</button>
            <button onClick={resetAllSavedData} style={smallButtonOrange}>Reset Saved Data</button>
            <button onClick={handleLogout} style={smallButtonGray}>Logout</button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: session.role === "Lab" ? "1.2fr 2fr" : "1fr",
            gap: "24px",
          }}
        >
          {session.role === "Lab" && (
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Lab Entry</h2>
              <p style={{ color: "#64748b" }}>Choose manual entry or scanned result sheet.</p>

              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <button
                  onClick={() => setEntryMode("manual")}
                  style={entryMode === "manual" ? activeTabStyle : inactiveTabStyle}
                >
                  Manual Entry
                </button>
                <button
                  onClick={() => setEntryMode("scan")}
                  style={entryMode === "scan" ? activeTabStyle : inactiveTabStyle}
                >
                  Scan Result Sheet
                </button>
              </div>

              {entryMode === "manual" ? (
                <form onSubmit={handleAddResult}>
                  <div style={{ marginBottom: "12px" }}>
                    <label>Barcode</label>
                    <input
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      style={inputStyle}
                      placeholder="Scan barcode"
                    />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label>MRN</label>
                    <input
                      value={form.mrn}
                      onChange={(e) => setForm({ ...form, mrn: e.target.value })}
                      style={inputStyle}
                      placeholder="Patient MRN"
                    />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label>Patient Name</label>
                    <input
                      value={form.patient}
                      onChange={(e) => setForm({ ...form, patient: e.target.value })}
                      style={inputStyle}
                      placeholder="Patient name"
                    />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label>Test</label>
                    <select
                      value={form.test}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          test: e.target.value,
                          result: "",
                          cbc: {
                            wbc: "",
                            rbc: "",
                            hb: "",
                            platelets: "",
                          },
                        })
                      }
                      style={inputStyle}
                    >
                      <option>CBC</option>
                      <option>Potassium</option>
                      <option>Creatinine</option>
                      <option>Troponin</option>
                    </select>
                  </div>

                  {form.test === "CBC" ? (
                    <div style={{ marginBottom: "12px" }}>
                      <label>CBC Panel</label>

                      <input
                        value={form.cbc.wbc}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            cbc: { ...form.cbc, wbc: e.target.value },
                          })
                        }
                        style={inputStyle}
                        placeholder="WBC"
                      />

                      <input
                        value={form.cbc.rbc}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            cbc: { ...form.cbc, rbc: e.target.value },
                          })
                        }
                        style={{ ...inputStyle, marginTop: "10px" }}
                        placeholder="RBC"
                      />

                      <input
                        value={form.cbc.hb}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            cbc: { ...form.cbc, hb: e.target.value },
                          })
                        }
                        style={{ ...inputStyle, marginTop: "10px" }}
                        placeholder="Hb"
                      />

                      <input
                        value={form.cbc.platelets}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            cbc: { ...form.cbc, platelets: e.target.value },
                          })
                        }
                        style={{ ...inputStyle, marginTop: "10px" }}
                        placeholder="Platelets"
                      />
                    </div>
                  ) : (
                    <div style={{ marginBottom: "12px" }}>
                      <label>Result</label>
                      <input
                        value={form.result}
                        onChange={(e) => setForm({ ...form, result: e.target.value })}
                        style={inputStyle}
                        placeholder="Enter result"
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: "12px" }}>
                    <label>Time</label>
                    <input
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      style={inputStyle}
                      placeholder="10:45"
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label>Technician Name</label>
                    <input
                      value={form.technician}
                      onChange={(e) => setForm({ ...form, technician: e.target.value })}
                      style={inputStyle}
                      placeholder="Technician name"
                    />
                  </div>

                  <button type="submit" style={buttonStyle}>
                    Save Manual Result
                  </button>
                </form>
              ) : (
                <div>
                  <div style={{ marginBottom: "12px" }}>
                    <label>Barcode</label>
                    <input
                      value={scanForm.barcode}
                      onChange={(e) => setScanForm({ ...scanForm, barcode: e.target.value })}
                      style={inputStyle}
                      placeholder="Scan barcode"
                    />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label>MRN</label>
                    <input
                      value={scanForm.mrn}
                      onChange={(e) => setScanForm({ ...scanForm, mrn: e.target.value })}
                      style={inputStyle}
                      placeholder="Patient MRN"
                    />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label>Patient Name</label>
                    <input
                      value={scanForm.patient}
                      onChange={(e) => setScanForm({ ...scanForm, patient: e.target.value })}
                      style={inputStyle}
                      placeholder="Patient name"
                    />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label>Test</label>
                    <select
                      value={scanForm.test}
                      onChange={(e) => {
                        setScanForm({ ...scanForm, test: e.target.value });
                        setExtractedData(null);
                      }}
                      style={inputStyle}
                    >
                      <option>CBC</option>
                      <option>Potassium</option>
                      <option>Creatinine</option>
                      <option>Troponin</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: "12px" }}>
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
                      <img
                        src={scanForm.filePreview}
                        alt="Uploaded result sheet preview"
                        style={{
                          width: "100%",
                          maxHeight: 220,
                          objectFit: "contain",
                          border: "1px solid #cbd5e1",
                          borderRadius: 12,
                          background: "#fff",
                        }}
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: "12px" }}>
                    <label>OCR Text</label>
                    <textarea
                      value={scanForm.ocrText}
                      onChange={(e) => setScanForm({ ...scanForm, ocrText: e.target.value })}
                      style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                      placeholder="Paste OCR output here, e.g. WBC 8.5 RBC 4.7 HB 13.2 Platelets 220"
                    />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label>Time</label>
                    <input
                      value={scanForm.time}
                      onChange={(e) => setScanForm({ ...scanForm, time: e.target.value })}
                      style={inputStyle}
                      placeholder="10:45"
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label>Technician Name</label>
                    <input
                      value={scanForm.technician}
                      onChange={(e) => setScanForm({ ...scanForm, technician: e.target.value })}
                      style={inputStyle}
                      placeholder="Technician name"
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <button type="button" onClick={extractFromOCR} style={smallButtonBlue}>
                      Extract Results
                    </button>
                    <button type="button" onClick={handleSaveScannedResult} style={buttonStyleInline}>
                      Confirm & Save
                    </button>
                  </div>

                  {extractedData && (
                    <div style={reviewCardStyle}>
                      <div style={{ fontWeight: "bold", marginBottom: 10 }}>Extracted Results Review</div>
                      <div style={{ marginBottom: 8 }}><strong>Test:</strong> {extractedData.test}</div>
                      <div style={{ marginBottom: 8 }}><strong>Result:</strong> {extractedData.result}</div>
                      <div>
                        <strong>Status:</strong>{" "}
                        <span
                          style={{
                            ...badgeStyle(extractedData.status),
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: "bold",
                            display: "inline-block",
                          }}
                        >
                          {extractedData.status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={panelStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ marginTop: 0, marginBottom: "6px" }}>
                  {session.role === "Doctor" ? "Doctor Portal" : "Doctor View"}
                </h2>
                <p style={{ color: "#64748b", margin: 0 }}>
                  {session.role === "Doctor"
                    ? "Search by patient MRN to view results"
                    : "Search temporary results during LIS downtime"}
                </p>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, width: "280px", marginBottom: 0 }}
                placeholder={
                  session?.role === "Doctor"
                    ? "Search by patient MRN only..."
                    : "Search by barcode, MRN, patient..."
                }
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginTop: "20px",
                marginBottom: "20px",
              }}
            >
              <div style={cardStyle}>
                <div style={{ color: "#64748b", fontSize: "14px" }}>Results Entered</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", marginTop: "8px" }}>
                  {results.length}
                </div>
              </div>

              <div style={{ ...cardStyle, background: "#fef2f2", border: "1px solid #fecaca" }}>
                <div style={{ color: "#b91c1c", fontSize: "14px" }}>Critical Alerts</div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginTop: "8px",
                    color: "#b91c1c",
                  }}
                >
                  {criticalCount}
                </div>
              </div>

              <div style={{ ...cardStyle, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div style={{ color: "#1d4ed8", fontSize: "14px" }}>Pending Sync</div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginTop: "8px",
                    color: "#1d4ed8",
                  }}
                >
                  {pendingSyncCount}
                </div>
              </div>
            </div>

            {session?.role === "Doctor" && !search.trim() && (
              <div
                style={{
                  marginTop: "8px",
                  marginBottom: "16px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: "16px",
                  padding: "16px",
                  color: "#9a3412",
                  fontWeight: "bold",
                }}
              >
                Please enter the patient MRN to view results.
              </div>
            )}

            {session?.role === "Doctor" && search.trim() && filteredResults.length === 0 && (
              <div
                style={{
                  marginTop: "8px",
                  marginBottom: "16px",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "16px",
                  padding: "16px",
                  color: "#475569",
                  fontWeight: "bold",
                }}
              >
                No results found for this MRN.
              </div>
            )}

            {session?.role === "Doctor" && !search.trim() ? null : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={thStyle}>Barcode</th>
                      <th style={thStyle}>MRN</th>
                      <th style={thStyle}>Patient</th>
                      <th style={thStyle}>Test</th>
                      <th style={thStyle}>Result</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Sync</th>
                      <th style={thStyle}>Source</th>
                      <th style={thStyle}>Time</th>
                      <th style={thStyle}>Technician</th>
                      <th style={thStyle}>Note</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((item, index) => (
                      <tr key={index}>
                        <td style={tdStyle}>{item.barcode}</td>
                        <td style={tdStyle}>{item.mrn}</td>
                        <td style={tdStyle}>{item.patient}</td>
                        <td style={tdStyle}>{item.test}</td>
                        <td style={tdStyle}>{item.result}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              ...badgeStyle(item.status),
                              borderRadius: "999px",
                              padding: "6px 12px",
                              fontSize: "12px",
                              fontWeight: "bold",
                              display: "inline-block",
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              ...syncBadgeStyle(item.synced),
                              borderRadius: "999px",
                              padding: "6px 12px",
                              fontSize: "12px",
                              fontWeight: "bold",
                              display: "inline-block",
                            }}
                          >
                            {item.synced ? "Synced" : "Pending"}
                          </span>
                        </td>
                        <td style={tdStyle}>{item.source}</td>
                        <td style={tdStyle}>{item.time}</td>
                        <td style={tdStyle}>{item.technician}</td>
                        <td style={tdStyle}>{item.note}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {session.role === "Lab" && !item.synced && (
                              <button style={smallButtonBlue} onClick={() => handleSync(index)}>
                                Sync to LIS
                              </button>
                            )}
                            <button style={smallButtonGray} onClick={() => handlePrint(item)}>
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={aiNoteStyle}>
              <strong>AI Safety Layer:</strong> results and downtime work are saved locally in the browser,
              can be exported to CSV, and re-imported while awaiting full system integration.
            </div>
          </div>
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

const topLogoBoxStyle = {
  width: "180px",
  minHeight: "82px",
  borderRadius: "18px",
  background: "rgba(255,255,255,0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.18)",
  backdropFilter: "blur(6px)",
  padding: "8px 12px",
};

const topLogoStyle = {
  width: "100%",
  maxHeight: "66px",
  objectFit: "contain",
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

const loginLogoStyle = {
  width: 170,
  maxHeight: 74,
  objectFit: "contain",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  padding: 8,
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
