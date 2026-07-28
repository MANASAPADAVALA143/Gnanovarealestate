import { useState } from "react";
import { ConsentCheckbox, useConsentGate } from "./ConsentCheckbox";
// import { supabase } from "../lib/supabaseClient";

interface DemoFormData {
  name: string; email: string; company: string;
  role: string; team_size: string; message: string;
}

export default function DemoBookingForm() {
  const [formData, setFormData] = useState<DemoFormData>({
    name: "", email: "", company: "", role: "", team_size: "1–5 agents", message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Pass your supabase client: useConsentGate(supabase)
  const { consentGiven, setConsentGiven, showConsentError, checkConsent, logConsent } =
    useConsentGate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!checkConsent()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, consent_given: true, consent_timestamp: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      await logConsent({ lead_id: data.id, email: formData.email, context: "demo" });
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please email hello@gnanova.pro");
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    background: "#0f1117", border: "1px solid #2d3748", borderRadius: "8px",
    padding: "10px 14px", fontSize: "14px", color: "#e2e8f0",
    outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "13px", fontWeight: "500", color: "#a0aec0", display: "block", marginBottom: "6px",
  };

  if (success) {
    return (
      <div style={{ maxWidth: "480px", margin: "80px auto", textAlign: "center", padding: "24px" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>✅</div>
        <h2 style={{ fontSize: "22px", fontWeight: "700", color: "#f7fafc", margin: "0 0 10px" }}>Demo request received</h2>
        <p style={{ fontSize: "15px", color: "#718096", lineHeight: "1.65", margin: 0 }}>
          We'll reach out within 24 hours to confirm a time. Check your inbox for a confirmation email.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "660px", margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#f7fafc", margin: "0 0 8px" }}>Book a product demo</h1>
        <p style={{ color: "#718096", fontSize: "15px", margin: 0 }}>
          See how Gnanova automates lead qualification for UAE real estate teams.
        </p>
      </div>
      <div style={{ background: "#1a1f2e", border: "1px solid #1e2535", borderRadius: "12px", padding: "28px" }}>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ marginBottom: "18px" }}>
              <label htmlFor="name" style={labelStyle}>Full name *</label>
              <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="Ahmed Al Rashidi" required style={fieldStyle} />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label htmlFor="email" style={labelStyle}>Work email *</label>
              <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="ahmed@brokerage.ae" required style={fieldStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ marginBottom: "18px" }}>
              <label htmlFor="company" style={labelStyle}>Company / brokerage *</label>
              <input id="company" name="company" type="text" value={formData.company} onChange={handleChange} placeholder="Your Real Estate LLC" required style={fieldStyle} />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label htmlFor="role" style={labelStyle}>Your role</label>
              <input id="role" name="role" type="text" value={formData.role} onChange={handleChange} placeholder="Sales Manager, Broker Owner…" style={fieldStyle} />
            </div>
          </div>
          <div style={{ marginBottom: "18px" }}>
            <label htmlFor="team_size" style={labelStyle}>Team size</label>
            <select id="team_size" name="team_size" value={formData.team_size} onChange={handleChange} style={fieldStyle}>
              {["1–5 agents", "6–15 agents", "16–50 agents", "50+ agents"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "18px" }}>
            <label htmlFor="message" style={labelStyle}>Anything specific you want to see?</label>
            <textarea id="message" name="message" value={formData.message} onChange={handleChange}
              placeholder="e.g. WhatsApp automation, Bayut lead intake, VAPI voice demos…"
              rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
          </div>
          <ConsentCheckbox checked={consentGiven} onChange={setConsentGiven} showError={showConsentError} context="demo" />
          {error && <p style={{ fontSize: "13px", color: "#f6ad55", margin: "0 0 12px" }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "13px", background: "linear-gradient(135deg,#3182ce,#553c9a)",
            color: "#fff", fontSize: "15px", fontWeight: "600", border: "none",
            borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "Submitting…" : "Request demo →"}
          </button>
        </form>
      </div>
    </div>
  );
}
