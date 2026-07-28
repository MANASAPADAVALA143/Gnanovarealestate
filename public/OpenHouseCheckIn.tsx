import { useState } from "react";
import { ConsentCheckbox, useConsentGate } from "./ConsentCheckbox";
// import { supabase } from "../lib/supabaseClient";

interface CheckInData {
  name: string; phone: string; email: string;
  looking_for: string; budget: string; timeline: string;
}
interface Props { eventId: string; propertyAddress: string; agentId: string; }

export default function OpenHouseCheckIn({ eventId, propertyAddress, agentId }: Props) {
  const [formData, setFormData] = useState<CheckInData>({
    name: "", phone: "", email: "", looking_for: "Buy", budget: "", timeline: "ASAP",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Pass your supabase client: useConsentGate(supabase)
  const { consentGiven, setConsentGiven, showConsentError, checkConsent, logConsent } =
    useConsentGate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!checkConsent()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/open-house/${eventId}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, agent_id: agentId, consent_given: true, consent_timestamp: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Check-in failed");
      const data = await res.json();
      await logConsent({ lead_id: data.attendee_id, phone: formData.phone, email: formData.email, context: "openhouse" });
      setSuccess(true);
    } catch {
      setError("Check-in failed. Please ask the agent for help.");
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    background: "#0f1117", border: "1px solid #2d3748", borderRadius: "8px",
    padding: "11px 14px", fontSize: "15px", color: "#e2e8f0",
    outline: "none", width: "100%", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "13px", fontWeight: "500", color: "#a0aec0", display: "block", marginBottom: "6px",
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "32px 24px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏠</div>
        <h2 style={{ fontSize: "26px", fontWeight: "700", color: "#f7fafc", margin: "0 0 10px" }}>Welcome!</h2>
        <p style={{ fontSize: "15px", color: "#718096", lineHeight: "1.65", maxWidth: "360px", margin: "0 auto 24px" }}>
          You're checked in. Our agent will be in touch with more information about this property and similar listings.
        </p>
        <button onClick={() => { setSuccess(false); setFormData({ name: "", phone: "", email: "", looking_for: "Buy", budget: "", timeline: "ASAP" }); }}
          style={{ background: "transparent", border: "1px solid #2d3748", color: "#a0aec0", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}>
          Check in another guest
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 60px" }}>
      <div style={{ textAlign: "center", marginBottom: "28px", maxWidth: "480px", width: "100%" }}>
        <div style={{ display: "inline-block", background: "rgba(99,179,237,0.1)", border: "1px solid rgba(99,179,237,0.3)", color: "#63b3ed", fontSize: "11px", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 12px", borderRadius: "20px", marginBottom: "14px" }}>
          Open House
        </div>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f7fafc", margin: "0 0 6px" }}>{propertyAddress}</h1>
        <p style={{ fontSize: "14px", color: "#718096", margin: 0 }}>Please fill in your details to check in.</p>
      </div>
      <div style={{ background: "#1a1f2e", border: "1px solid #1e2535", borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "480px", boxSizing: "border-box" }}>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="oh-name" style={labelStyle}>Full name *</label>
            <input id="oh-name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="Your name" required style={fieldStyle} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="oh-phone" style={labelStyle}>Mobile number *</label>
            <input id="oh-phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+971 50 000 0000" required style={fieldStyle} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="oh-email" style={labelStyle}>Email address</label>
            <input id="oh-email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" style={fieldStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="oh-looking" style={labelStyle}>I'm looking to</label>
              <select id="oh-looking" name="looking_for" value={formData.looking_for} onChange={handleChange} style={fieldStyle}>
                {["Buy", "Rent", "Invest", "Just exploring"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="oh-timeline" style={labelStyle}>Timeline</label>
              <select id="oh-timeline" name="timeline" value={formData.timeline} onChange={handleChange} style={fieldStyle}>
                {["ASAP", "1–3 months", "3–6 months", "6+ months"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="oh-budget" style={labelStyle}>Budget (AED)</label>
            <input id="oh-budget" name="budget" type="text" value={formData.budget} onChange={handleChange} placeholder="e.g. 1,500,000 – 2,000,000" style={fieldStyle} />
          </div>
          <ConsentCheckbox checked={consentGiven} onChange={setConsentGiven} showError={showConsentError} context="openhouse" />
          {error && <p style={{ fontSize: "13px", color: "#f6ad55", margin: "0 0 12px" }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "14px", background: "linear-gradient(135deg,#3182ce,#553c9a)",
            color: "#fff", fontSize: "16px", fontWeight: "600", border: "none",
            borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "Checking in…" : "Check in →"}
          </button>
        </form>
      </div>
    </div>
  );
}
