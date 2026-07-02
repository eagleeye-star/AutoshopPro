import { useState, useMemo, useEffect, useRef } from "react";

// ── localStorage ──────────────────────────────────────────────────────────────
const STORAGE_KEY  = "autoshop_pro_data";
const LICENSE_KEY  = "autoshop_pro_license";
const TRIAL_DAYS   = 14;
const VALID_KEYS   = ["AUTOSHP-DEMO-TRIAL-0001", "AUTOSHP-AIFARMS-VIP-002"];

const loadJobs    = () => { try { const r = localStorage.getItem(STORAGE_KEY);  return r ? JSON.parse(r) : null; } catch { return null; } };
const saveJobs    = (j) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(j)); } catch {} };
const loadLicense = ()  => { try { const r = localStorage.getItem(LICENSE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveLicense = (l) => { try { localStorage.setItem(LICENSE_KEY, JSON.stringify(l)); } catch {} };

function daysLeft(expiry)  { if (!expiry) return 0; return Math.max(0, Math.ceil((new Date(expiry) - new Date()) / 86400000)); }
function isExpired(expiry) { if (!expiry) return true; return new Date(expiry) < new Date(); }

// ── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split("T")[0];
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STAGES = ["Received", "Diagnosing", "Awaiting Parts", "In Repair", "Testing", "Ready", "Collected"];
const STAGE_COLORS = ["#6B7280", "#2E86AB", "#F4A261", "#F4A261", "#52B788", "#52B788", "#374151"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const PRIORITY_COLORS = { Low: "#6B7280", Normal: "#2E86AB", High: "#F4A261", Urgent: "#EF4444" };

const SEED_JOBS = [];

const BLANK_JOB = {
  plateNumber: "", ownerName: "", ownerPhone: "", vehicleMake: "", vehicleYear: "", mileage: "",
  problemDescription: "", faultCodes: [], mechanicDiagnosis: "", stage: "Received", priority: "Normal",
  dateReceived: today(), expectedResolution: "", ownerRequests: "", laborCost: 0, partsCost: 0,
  notes: [], mechanicAssigned: "", paid: false,
};

// ── Sub-components ────────────────────────────────────────────────────────────
function StageBar({ stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {STAGES.map((s, i) => (
          <div key={s} title={s} style={{
            flex: 1, height: 5, borderRadius: 3,
            background: i <= idx ? STAGE_COLORS[idx] : "#374151",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: STAGE_COLORS[idx], marginTop: 4, display: "block" }}>{stage}</span>
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>{label}</span>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, required, mono }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 11, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}{required && " *"}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: "100%", background: "#1A1C1E", border: "1px solid #374151", borderRadius: 6,
          padding: "8px 10px", color: "#E8EDF2", fontSize: 13,
          fontFamily: mono ? "'Courier New', monospace" : "inherit", boxSizing: "border-box",
          outline: "none",
        }} />
    </div>
  );
}

function Select({ label, value, onChange, options, colors }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 11, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", background: "#1A1C1E", border: "1px solid #374151", borderRadius: 6,
          padding: "8px 10px", color: colors ? (colors[value] || "#E8EDF2") : "#E8EDF2",
          fontSize: 13, boxSizing: "border-box", outline: "none",
        }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 11, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>}
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{
          width: "100%", background: "#1A1C1E", border: "1px solid #374151", borderRadius: 6,
          padding: "8px 10px", color: "#E8EDF2", fontSize: 13, resize: "vertical",
          boxSizing: "border-box", outline: "none", fontFamily: "inherit",
        }} />
    </div>
  );
}

// ── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, onOpen }) {
  const overdue = job.expectedResolution && job.stage !== "Collected" && new Date(job.expectedResolution) < new Date();
  return (
    <div onClick={() => onOpen(job)} style={{
      background: "#2D3035", borderRadius: 10, padding: 16, cursor: "pointer",
      border: `1px solid ${overdue ? "#EF444455" : "#374151"}`,
      transition: "border-color 0.2s, transform 0.15s",
      position: "relative", overflow: "hidden",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = overdue ? "#EF4444" : "#2E86AB"}
      onMouseLeave={e => e.currentTarget.style.borderColor = overdue ? "#EF444455" : "#374151"}
    >
      {overdue && <div style={{ position: "absolute", top: 0, right: 0, background: "#EF4444", color: "#fff", fontSize: 10, padding: "2px 8px", borderBottomLeftRadius: 6, fontWeight: 700 }}>OVERDUE</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 15, color: "#F4A261", letterSpacing: 1 }}>{job.plateNumber || "—"}</span>
        <Badge label={job.priority} color={PRIORITY_COLORS[job.priority]} />
      </div>
      <div style={{ fontSize: 14, color: "#E8EDF2", fontWeight: 600, marginBottom: 2 }}>{job.vehicleMake} {job.vehicleYear}</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>{job.ownerName} · {job.ownerPhone}</div>
      <div style={{ fontSize: 12, color: "#D1D5DB", marginBottom: 10, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {job.problemDescription}
      </div>
      {job.faultCodes.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {job.faultCodes.map(c => <span key={c} style={{ fontFamily: "monospace", background: "#1A1C1E", color: "#F4A261", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>{c}</span>)}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: "#6B7280" }}>Due: {fmt(job.expectedResolution)}</span>
        <span style={{ fontSize: 11, color: "#6B7280" }}>{job.mechanicAssigned || "Unassigned"}</span>
      </div>
      <StageBar stage={job.stage} />
    </div>
  );
}

// ── Job Form Modal ────────────────────────────────────────────────────────────
function JobModal({ job, onSave, onClose, onDelete }) {
  const [form, setForm] = useState({ ...job });
  const [codeInput, setCodeInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const addCode = () => {
    const c = codeInput.trim().toUpperCase();
    if (c && !form.faultCodes.includes(c)) {
      setForm(f => ({ ...f, faultCodes: [...f.faultCodes, c] }));
      setCodeInput("");
    }
  };
  const removeCode = (c) => setForm(f => ({ ...f, faultCodes: f.faultCodes.filter(x => x !== c) }));

  const addNote = () => {
    if (!noteInput.trim()) return;
    const note = { id: uid(), text: noteInput.trim(), time: new Date().toLocaleString("en-GB") };
    setForm(f => ({ ...f, notes: [...f.notes, note] }));
    setNoteInput("");
  };

  const total = (Number(form.laborCost) || 0) + (Number(form.partsCost) || 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 12px", overflowY: "auto" }}>
      <div style={{ background: "#2D3035", borderRadius: 12, width: "100%", maxWidth: 640, padding: 24, border: "1px solid #374151" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#E8EDF2", fontSize: 18 }}>{job.id ? "Edit Job" : "New Job"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {/* Section: Vehicle & Owner */}
        <SectionLabel>Vehicle & Owner</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Input label="Plate Number" value={form.plateNumber} onChange={set("plateNumber")} mono placeholder="GW 1234-23" required />
          <Input label="Vehicle Make & Model" value={form.vehicleMake} onChange={set("vehicleMake")} placeholder="Toyota Corolla" />
          <Input label="Year" value={form.vehicleYear} onChange={set("vehicleYear")} placeholder="2020" />
          <Input label="Mileage" value={form.mileage} onChange={set("mileage")} placeholder="80,000 km" />
          <Input label="Owner Name" value={form.ownerName} onChange={set("ownerName")} placeholder="Kwame Asante" required />
          <Input label="Owner Phone" value={form.ownerPhone} onChange={set("ownerPhone")} placeholder="0244 123 456" />
        </div>

        {/* Section: Job Details */}
        <SectionLabel>Job Details</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Input label="Date Received" value={form.dateReceived} onChange={set("dateReceived")} type="date" />
          <Input label="Expected Resolution Date" value={form.expectedResolution} onChange={set("expectedResolution")} type="date" />
          <Select label="Stage" value={form.stage} onChange={set("stage")} options={STAGES} />
          <Select label="Priority" value={form.priority} onChange={set("priority")} options={PRIORITIES} colors={PRIORITY_COLORS} />
          <Input label="Assigned Mechanic" value={form.mechanicAssigned} onChange={set("mechanicAssigned")} placeholder="Mechanic name" />
        </div>

        {/* Section: Problem */}
        <SectionLabel>Problem Report</SectionLabel>
        <Textarea label="Owner's Problem Description" value={form.problemDescription} onChange={set("problemDescription")} rows={3} placeholder="Describe what the owner reported..." />
        <Textarea label="Owner's Special Requests" value={form.ownerRequests} onChange={set("ownerRequests")} rows={2} placeholder="e.g. OEM parts only, budget limit, callback required..." />

        {/* Section: Diagnostics */}
        <SectionLabel>Mechanic Diagnostics</SectionLabel>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Fault / Error Codes</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={codeInput} onChange={e => setCodeInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCode()}
              placeholder="P0300, C0031… then press Enter"
              style={{ flex: 1, background: "#1A1C1E", border: "1px solid #374151", borderRadius: 6, padding: "8px 10px", color: "#F4A261", fontSize: 13, fontFamily: "monospace", outline: "none" }} />
            <button onClick={addCode} style={{ background: "#2E86AB", border: "none", borderRadius: 6, color: "#fff", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>+ Add</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {form.faultCodes.map(c => (
              <span key={c} style={{ background: "#1A1C1E", color: "#F4A261", borderRadius: 4, padding: "3px 8px", fontSize: 12, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                {c} <button onClick={() => removeCode(c)} style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", padding: 0, fontSize: 12 }}>✕</button>
              </span>
            ))}
          </div>
        </div>
        <Textarea label="Mechanic's Full Diagnosis" value={form.mechanicDiagnosis} onChange={set("mechanicDiagnosis")} rows={3} placeholder="Detailed technical findings..." />

        {/* Section: Costs */}
        <SectionLabel>Costs & Payment</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
          <Input label="Labour Cost (GH₵)" value={form.laborCost} onChange={set("laborCost")} type="number" placeholder="0" />
          <Input label="Parts Cost (GH₵)" value={form.partsCost} onChange={set("partsCost")} type="number" placeholder="0" />
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Total</label>
            <div style={{ background: "#1A1C1E", border: "1px solid #52B78855", borderRadius: 6, padding: "8px 10px", color: "#52B788", fontSize: 16, fontWeight: 700 }}>GH₵ {total.toFixed(2)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <input type="checkbox" id="paid" checked={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.checked }))}
            style={{ width: 16, height: 16, accentColor: "#52B788" }} />
          <label htmlFor="paid" style={{ color: "#E8EDF2", fontSize: 13 }}>Mark as Paid</label>
        </div>

        {/* Section: Notes */}
        <SectionLabel>Work Notes & Updates</SectionLabel>
        <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 8 }}>
          {form.notes.length === 0 && <p style={{ color: "#6B7280", fontSize: 12, margin: 0 }}>No notes yet.</p>}
          {form.notes.map(n => (
            <div key={n.id} style={{ background: "#1A1C1E", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: "#E8EDF2" }}>{n.text}</div>
              <div style={{ fontSize: 10, color: "#6B7280", marginTop: 3 }}>{n.time}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()}
            placeholder="Add a work note or update…"
            style={{ flex: 1, background: "#1A1C1E", border: "1px solid #374151", borderRadius: 6, padding: "8px 10px", color: "#E8EDF2", fontSize: 13, outline: "none" }} />
          <button onClick={addNote} style={{ background: "#374151", border: "none", borderRadius: 6, color: "#E8EDF2", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Log</button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
          <div>
            {job.id && <button onClick={() => onDelete(job.id)} style={{ background: "none", border: "1px solid #EF4444", borderRadius: 6, color: "#EF4444", padding: "9px 16px", cursor: "pointer", fontSize: 13 }}>Delete Job</button>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #374151", borderRadius: 6, color: "#9CA3AF", padding: "9px 16px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button onClick={() => onSave(form)} style={{ background: "#2E86AB", border: "none", borderRadius: 6, color: "#fff", padding: "9px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Save Job</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ color: "#2E86AB", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #374151", paddingBottom: 6, marginBottom: 12, marginTop: 8 }}>{children}</div>;
}

// ── LICENCE SCREENS ───────────────────────────────────────────────────────────
function LicenseScreen({ onActivate }) {
  const [mode, setMode] = useState("trial");
  const [key, setKey]   = useState("");
  const [err, setErr]   = useState("");

  const C = { bg: "#16191f", card: "#1f2330", border: "#2E3A4A", text: "#E8EDF2", muted: "#9CA3AF", accent: "#2E86AB", gold: "#F4A261", red: "#EF4444" };

  const startTrial = () => {
    const expiry = new Date(); expiry.setDate(expiry.getDate() + TRIAL_DAYS);
    const lic = { type: "trial", key: null, expiry: expiry.toISOString(), issued: new Date().toISOString() };
    saveLicense(lic); onActivate(lic);
  };

  const activateKey = () => {
    const k = key.toUpperCase().trim();
    if (!k) { setErr("Enter a licence key."); return; }
    const validFormat = /^AUTOSHP-[A-Z0-9]{1,8}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(k) || VALID_KEYS.includes(k);
    if (!validFormat) { setErr("Invalid key. Format: AUTOSHP-PLAN-XXXX-XXXX"); return; }
    const planSeg = k.split("-")[1] || "";
    let days = 365;
    if (planSeg === "TRIAL") days = TRIAL_DAYS;
    else if (planSeg === "1M")  days = 30;
    else if (planSeg === "6M")  days = 182;
    else if (planSeg === "12M") days = 365;
    else if (/^\d+Y$/.test(planSeg)) days = Math.round(parseInt(planSeg) * 365);
    const expiry = new Date(); expiry.setDate(expiry.getDate() + days);
    const lic = { type: "licensed", key: k, expiry: expiry.toISOString(), issued: new Date().toISOString() };
    saveLicense(lic); onActivate(lic);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#161b22 50%,#0d1117 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "36px 32px", width: "min(94vw,440px)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🔧</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accent, marginBottom: 4 }}>AutoShop Pro</div>
          <div style={{ color: C.muted, fontSize: 13 }}>Auto Repair & Job Card Manager</div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["trial", "activate"].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `2px solid ${mode === m ? C.accent : C.border}`, background: mode === m ? `${C.accent}22` : "transparent", color: mode === m ? C.accent : C.muted, cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all .15s" }}>
              {m === "trial" ? "Free Trial" : "Activate Licence"}
            </button>
          ))}
        </div>

        {mode === "trial" && (
          <div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 14px" }}>
              Start a <strong style={{ color: C.accent }}>{TRIAL_DAYS}-day free trial</strong>. Full access to all job cards, diagnostics tracking, cost management, and backup features. No payment required.
            </p>
            <div style={{ background: `${C.gold}18`, border: `1px solid ${C.gold}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: C.gold, lineHeight: 1.6 }}>
              ⚠ Purchase a licence before trial ends to keep your data and job history.
            </div>
            <button onClick={startTrial} style={{ width: "100%", padding: "13px 0", background: `linear-gradient(135deg,${C.accent},#1a6080)`, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              Start {TRIAL_DAYS}-Day Free Trial
            </button>
          </div>
        )}

        {mode === "activate" && (
          <div>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 10px" }}>Enter your AutoShop Pro licence key.</p>
            <input value={key} onChange={e => { setKey(e.target.value.toUpperCase()); setErr(""); }} onKeyDown={e => e.key === "Enter" && activateKey()}
              placeholder="AUTOSHP-PLAN-XXXX-XXXX"
              style={{ width: "100%", padding: "11px 12px", background: C.bg, border: `1.5px solid ${err ? C.red : C.border}`, borderRadius: 8, fontSize: 14, color: C.text, textAlign: "center", boxSizing: "border-box", letterSpacing: 2, marginBottom: 8, fontFamily: "monospace", outline: "none" }} />
            {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{err}</div>}
            <button onClick={activateKey} style={{ width: "100%", padding: "13px 0", background: `linear-gradient(135deg,${C.accent},#1a6080)`, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              Activate
            </button>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 14, textAlign: "center", lineHeight: 1.7 }}>
              Contact: <strong style={{ color: C.accent }}>0597147460</strong> · <strong style={{ color: C.accent }}>aifarms101@gmail.com</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LicenseExpiredScreen({ license, onRenew }) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1a0505 0%,#2d0f0f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ background: "#1f2330", border: "1px solid #EF444455", borderRadius: 18, padding: "36px 32px", width: "min(94vw,420px)", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⏰</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#EF4444", marginBottom: 8 }}>
          {license?.type === "trial" ? "Trial Expired" : "Licence Expired"}
        </div>
        <p style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.7, marginBottom: 8 }}>
          Your {license?.type === "trial" ? "free trial" : "licence"} expired on{" "}
          <strong style={{ color: "#E8EDF2" }}>{new Date(license?.expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</strong>.
        </p>
        <p style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.7, marginBottom: 24 }}>
          All your job cards are safely saved. Activate a licence to regain full access.
        </p>
        <button onClick={onRenew} style={{ width: "100%", padding: "13px 0", background: "linear-gradient(135deg,#2E86AB,#1a6080)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 12 }}>
          🔑 Activate Licence
        </button>
        <p style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.7 }}>
          Contact: <strong style={{ color: "#2E86AB" }}>0597147460</strong> · <strong style={{ color: "#2E86AB" }}>aifarms101@gmail.com</strong>
        </p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function AutoShopPro() {
  const [license, setLicenseState] = useState(() => loadLicense());
  const [institution, setInstitution] = useState(() => loadInstitution(STORAGE_KEY));
  const [showReset, setShowReset] = useState(false);
  const [renewMode, setRenewMode]  = useState(false);
  const [jobs, setJobs]            = useState(() => loadJobs() || SEED_JOBS);
  const [modal, setModal]          = useState(null);
  const [search, setSearch]        = useState("");
  const [filterStage, setFilterStage]       = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [view, setView]            = useState("board"); // board | list | backup
  const fileInputRef               = useRef(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [backupMsg, setBackupMsg]  = useState(null);

  // Persist jobs to localStorage whenever they change
  useEffect(() => { saveJobs(jobs); }, [jobs]);
  // ── Auto-activate from portal launch URL ─────────────────────────────────
  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get('key');
    if (urlKey && !loadLicense()) {
      const k = urlKey.toUpperCase().trim();
      if (/^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(k)) {
        const plan = k.split("-")[1]||"";
        const days = plan==="TRIAL"?TRIAL_DAYS:plan==="1M"?30:plan==="6M"?182:plan==="12M"?365:/^\d+Y$/.test(plan)?Math.round(parseInt(plan)*365):365;
        const expiry = new Date(); expiry.setDate(expiry.getDate()+days);
        const lic = { type:"licensed", key:k, expiry:expiry.toISOString(), issued:new Date().toISOString() };
        saveLicense(lic); setLicenseState(lic);
        window.history.replaceState({},document.title,window.location.pathname);
      }
    }
  }, []);

  // ── Licence gate ───────────────────────────────────────────────────────────
  const onActivate = (lic) => { setLicenseState(lic); setRenewMode(false); };
  if (!license || renewMode)      return <LicenseScreen onActivate={onActivate} />;
  if (isExpired(license?.expiry)) return <LicenseExpiredScreen license={license} onRenew={() => setRenewMode(true)} />;

  const trialDaysLeft = license.type === "trial" ? daysLeft(license.expiry) : null;

  const filtered = useMemo(() => jobs.filter(j => {
    const q = search.toLowerCase();
    const matchSearch = !q || j.plateNumber.toLowerCase().includes(q) || j.ownerName.toLowerCase().includes(q) || j.vehicleMake.toLowerCase().includes(q) || j.faultCodes.some(c => c.toLowerCase().includes(q));
    const matchStage = filterStage === "All" || j.stage === filterStage;
    const matchPriority = filterPriority === "All" || j.priority === filterPriority;
    return matchSearch && matchStage && matchPriority;
  }), [jobs, search, filterStage, filterPriority]);

  const saveJob = (form) => {
    if (!form.plateNumber.trim()) return alert("Plate number is required.");
    setJobs(js => form.id ? js.map(j => j.id === form.id ? form : j) : [...js, { ...form, id: uid() }]);
    setModal(null);
  };

  const deleteJob = (id) => {
    if (!confirm("Delete this job permanently?")) return;
    setJobs(js => js.filter(j => j.id !== id));
    setModal(null);
  };

  // Stats
  const stats = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter(j => !["Ready", "Collected"].includes(j.stage)).length,
    ready: jobs.filter(j => j.stage === "Ready").length,
    overdue: jobs.filter(j => j.expectedResolution && j.stage !== "Collected" && new Date(j.expectedResolution) < new Date()).length,
    revenue: jobs.filter(j => j.paid).reduce((s, j) => s + (Number(j.laborCost) || 0) + (Number(j.partsCost) || 0), 0),
    unpaid: jobs.filter(j => !j.paid && j.stage !== "Received").reduce((s, j) => s + (Number(j.laborCost) || 0) + (Number(j.partsCost) || 0), 0),
  }), [jobs]);

  const saveInst = (inst) => { setInstitution(inst); saveInstitution(STORAGE_KEY, inst); };
  const adminPin = "1234"; // Users set their own after setup

  return (
    <div style={{ background: "#1A1C1E", minHeight: "100vh", color: "#E8EDF2", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

      {/* Licence expiry banner (Update 8) */}
      <ExpiryBanner expiry={license?.expiry} phone="0597147460" />

      {/* Trial warning banner */}
      {trialDaysLeft !== null && trialDaysLeft <= 7 && (
        <div style={{ background: trialDaysLeft <= 2 ? "#EF4444" : "#F4A261", color: "#000", textAlign: "center", padding: "6px 16px", fontSize: 12, fontWeight: 700 }}>
          ⚠ Trial expires in <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong> — contact 0597147460 to activate a full licence.
        </div>
      )}

      {/* Top Bar */}
      <div style={{ background: "#2D3035", borderBottom: "1px solid #374151", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔧</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#E8EDF2", letterSpacing: 0.3 }}>AutoShop Pro</div>
            <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: 0.5 }}>MECHANIC JOB TRACKER</div>
            {institution?.name && <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600, marginTop: 1 }}>{institution.name}{institution.address ? ` · ${institution.address}` : ""}</div>}
          </div>
        </div>
        <button onClick={() => setModal({ ...BLANK_JOB })} style={{
          background: "#2E86AB", border: "none", borderRadius: 8, color: "#fff",
          padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
        }}>＋ New Job</button>
      </div>

      {/* Stats Bar */}
      <div style={{ display: "flex", gap: 12, padding: "16px 24px", overflowX: "auto", borderBottom: "1px solid #374151" }}>
        {[
          { label: "Total Jobs", value: stats.total, color: "#2E86AB" },
          { label: "Active", value: stats.active, color: "#F4A261" },
          { label: "Ready for Pickup", value: stats.ready, color: "#52B788" },
          { label: "Overdue", value: stats.overdue, color: "#EF4444" },
          { label: "Collected Revenue", value: `GH₵ ${stats.revenue.toFixed(0)}`, color: "#52B788" },
          { label: "Unpaid Balance", value: `GH₵ ${stats.unpaid.toFixed(0)}`, color: "#F4A261" },
        ].map(s => (
          <div key={s.label} style={{ background: "#2D3035", borderRadius: 8, padding: "10px 16px", minWidth: 120, border: `1px solid ${s.color}33`, flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding: "14px 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #374151" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plate, owner, fault code…"
          style={{ background: "#2D3035", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", color: "#E8EDF2", fontSize: 13, width: 240, outline: "none" }} />

        <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
          style={{ background: "#2D3035", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "#E8EDF2", fontSize: 13, outline: "none" }}>
          <option value="All">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>

        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ background: "#2D3035", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "#E8EDF2", fontSize: 13, outline: "none" }}>
          <option value="All">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>

        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["board", "list", "backup"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? "#2E86AB" : "#2D3035", border: "1px solid #374151",
              borderRadius: 6, color: view === v ? "#fff" : "#9CA3AF", padding: "7px 14px", cursor: "pointer", fontSize: 12, textTransform: "capitalize",
            }}>{v === "board" ? "🗂 Board" : v === "list" ? "☰ List" : "💾 Backup"}</button>
          ))}
        </div>
      </div>

      {/* Jobs */}
      <div style={{ padding: "20px 24px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#6B7280", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔩</div>
            <div style={{ fontSize: 15 }}>No jobs found. Tap <strong style={{ color: "#2E86AB" }}>+ New Job</strong> to log the first one.</div>
          </div>
        )}
        {view === "board" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {filtered.map(j => <JobCard key={j.id} job={j} onOpen={setModal} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(j => (
              <div key={j.id} onClick={() => setModal(j)} style={{
                background: "#2D3035", borderRadius: 8, padding: "12px 16px", cursor: "pointer",
                border: "1px solid #374151", display: "grid", gridTemplateColumns: "130px 1fr 1fr 120px 120px 100px",
                gap: 12, alignItems: "center",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#2E86AB"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#374151"}>
                <span style={{ fontFamily: "monospace", color: "#F4A261", fontWeight: 700 }}>{j.plateNumber}</span>
                <span style={{ color: "#E8EDF2", fontSize: 13 }}>{j.ownerName}<br /><span style={{ color: "#9CA3AF", fontSize: 11 }}>{j.vehicleMake} {j.vehicleYear}</span></span>
                <span style={{ color: "#D1D5DB", fontSize: 12, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{j.problemDescription}</span>
                <Badge label={j.stage} color={STAGE_COLORS[STAGES.indexOf(j.stage)]} />
                <Badge label={j.priority} color={PRIORITY_COLORS[j.priority]} />
                <span style={{ color: "#52B788", fontSize: 13, fontWeight: 600 }}>GH₵ {(Number(j.laborCost) + Number(j.partsCost)).toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup & Restore */}
      {view === "backup" && (
        <div style={{ padding: "20px 24px", maxWidth: 700 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#E8EDF2", marginBottom: 6 }}>💾 Backup & Restore</div>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
            All job card data is saved in this browser's localStorage. Download a backup regularly and store it in Google Drive, email, or USB — so you can recover data even years from now.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Download Backup */}
            <div style={{ background: "#2D3035", border: "1px solid #374151", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#E8EDF2", marginBottom: 8 }}>⬇️ Export Backup</div>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14, lineHeight: 1.6 }}>Downloads all {jobs.length} job cards as a JSON file you can store safely.</p>
              <button onClick={() => {
                const blob = new Blob([JSON.stringify({ app: "AutoShop Pro", exportedAt: new Date().toISOString(), version: 1, data: jobs }, null, 2)], { type: "application/json" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                a.download = `AutoShopPro-backup-${new Date().toISOString().slice(0,10)}.json`;
                document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
                setBackupMsg({ type: "ok", text: `Backup downloaded — ${jobs.length} job cards saved.` });
                setTimeout(() => setBackupMsg(null), 4000);
              }} style={{ width: "100%", background: "#2E86AB", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                ⬇️ Download Backup (.json)
              </button>
            </div>
            {/* Restore */}
            <div style={{ background: "#2D3035", border: "1px solid #374151", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#E8EDF2", marginBottom: 8 }}>⬆️ Restore from Backup</div>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14, lineHeight: 1.6 }}>Select a previously downloaded .json backup file to restore all job cards.</p>
              <label style={{ display: "block", textAlign: "center", padding: "10px 0", background: "#374151", color: "#9CA3AF", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                📂 Choose Backup File…
                <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files[0]; if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => { try {
                    const p = JSON.parse(reader.result);
                    if (!Array.isArray(p.data)) { setBackupMsg({ type: "err", text: "Not a valid AutoShop Pro backup file." }); return; }
                    setRestorePreview(p);
                  } catch { setBackupMsg({ type: "err", text: "Could not read file. Make sure it's a valid backup." }); } };
                  reader.readAsText(file); e.target.value = "";
                }} />
              </label>
            </div>
          </div>
          {/* Export CSV */}
          <div style={{ background: "#2D3035", border: "1px solid #374151", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#E8EDF2", marginBottom: 8 }}>📊 Export Job Cards to CSV</div>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Export all job cards as a spreadsheet for reporting or sharing.</p>
            <button onClick={() => {
              const rows = [["Plate", "Owner", "Phone", "Vehicle", "Year", "Stage", "Priority", "Labour (GH₵)", "Parts (GH₵)", "Total (GH₵)", "Paid", "Date Received", "Expected Resolution", "Mechanic"]];
              jobs.forEach(j => rows.push([j.plateNumber, j.ownerName, j.ownerPhone, j.vehicleMake, j.vehicleYear, j.stage, j.priority, j.laborCost, j.partsCost, Number(j.laborCost)+Number(j.partsCost), j.paid?"Yes":"No", j.dateReceived, j.expectedResolution||"", j.mechanicAssigned]));
              const csv = rows.map(r => r.map(c => `"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
              const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
              a.download = `AutoShopPro-jobs-${new Date().toISOString().slice(0,10)}.csv`;
              document.body.appendChild(a); a.click(); a.remove();
              setBackupMsg({ type: "ok", text: "CSV exported successfully." });
              setTimeout(() => setBackupMsg(null), 3000);
            }} style={{ background: "#52B788", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              📊 Export to CSV
            </button>
          </div>
          {backupMsg && (
            <div style={{ padding: "12px 16px", borderRadius: 8, background: backupMsg.type === "ok" ? "#14532d" : "#7f1d1d", color: backupMsg.type === "ok" ? "#86efac" : "#fca5a5", fontSize: 13, fontWeight: 600 }}>
              {backupMsg.type === "ok" ? "✅ " : "❌ "}{backupMsg.text}
            </div>
          )}
          {/* Institution Settings (Update 5) */}
          <div style={{ background: "#2D3035", border: "1px solid #374151", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#E8EDF2", marginBottom: 8 }}>🏢 Business Profile</div>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>This name and address appears on receipts and in the app header.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={institution.name} onChange={e=>saveInst({...institution,name:e.target.value})} placeholder="Business Name" style={{ padding:"9px 11px", background:"#1A1C1E", border:"1px solid #374151", borderRadius:7, color:"#E8EDF2", fontSize:13, outline:"none", fontFamily:"inherit" }} />
              <input value={institution.address} onChange={e=>saveInst({...institution,address:e.target.value})} placeholder="Address" style={{ padding:"9px 11px", background:"#1A1C1E", border:"1px solid #374151", borderRadius:7, color:"#E8EDF2", fontSize:13, outline:"none", fontFamily:"inherit" }} />
            </div>
          </div>

          {/* Reset (Update 1) */}
          <div style={{ background: "#2D3035", border: "1px solid #ef444444", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#ef4444", marginBottom: 8 }}>🗑 Reset All Data</div>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Permanently deletes all job cards and resets the app. Requires admin PIN. This cannot be undone.</p>
            <button onClick={()=>setShowReset(true)} style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontWeight:700, cursor:"pointer", fontSize:13 }}>🗑 Reset App Data</button>
          </div>

          {/* Data stats */}
          <div style={{ marginTop: 20, background: "#2D3035", border: "1px solid #374151", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Current Data Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[["Total Jobs", jobs.length], ["Active", jobs.filter(j=>j.stage!=="Collected").length], ["Collected", jobs.filter(j=>j.stage==="Collected").length], ["Unpaid", jobs.filter(j=>!j.paid).length]].map(([l,v])=>(
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#2E86AB" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal (Update 1) */}
      {showReset && (
        <ResetModal
          adminPin={adminPin}
          accent="#2E86AB"
          cardBg="#1f2330"
          onCancel={()=>setShowReset(false)}
          onConfirm={()=>{
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LICENSE_KEY);
            localStorage.removeItem(STORAGE_KEY+"_inst");
            setShowReset(false);
            window.location.reload();
          }}
        />
      )}

      {/* Restore Confirmation Modal */}
      {restorePreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setRestorePreview(null)}>
          <div style={{ background: "#1F2126", border: "1px solid #374151", borderRadius: 14, padding: 28, maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#E8EDF2", marginBottom: 10 }}>⚠️ Confirm Restore</div>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 8 }}>
              Backup from <strong style={{ color: "#E8EDF2" }}>{new Date(restorePreview.exportedAt).toLocaleString()}</strong>
            </p>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
              This will replace all <strong style={{ color: "#F4A261" }}>{jobs.length} current job cards</strong> with <strong style={{ color: "#52B788" }}>{restorePreview.data.length} job cards</strong> from the backup. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setRestorePreview(null)} style={{ flex: 1, background: "transparent", border: "1px solid #374151", borderRadius: 8, padding: "10px 0", color: "#9CA3AF", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { setJobs(restorePreview.data); setRestorePreview(null); setBackupMsg({ type: "ok", text: `Restored ${restorePreview.data.length} job cards successfully.` }); setTimeout(() => setBackupMsg(null), 4000); }} style={{ flex: 1, background: "#EF4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, cursor: "pointer" }}>
                ✅ Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && <JobModal job={modal} onSave={saveJob} onClose={() => setModal(null)} onDelete={deleteJob} />}
    </div>
  );
}
