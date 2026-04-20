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
const CANCEL_REASON_OPTIONS = [
  "Wrong sample",
  "Duplicate request",
  "Recollection needed",
  "Entered by mistake",
  "Doctor requested cancellation",
];

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
