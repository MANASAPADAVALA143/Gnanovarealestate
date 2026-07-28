import { useState } from "react";
import { ConsentCheckbox, useConsentGate } from "./ConsentCheckbox";
// Import your supabase client here:
// import { supabase } from "../lib/supabaseClient";

interface FormData {
  name: string;
  email: string;
  phone: string;
  location: string;
  timeline: string;
}

export default function LeadCaptureForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "", email: "", phone: "", location: "", timeline: "ASAP",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Pass your supabase client here: useConsentGate(supabase)
  const { consentGiven, setConsentGiven, showConsentError, checkConsent, logConsent } =
    useConsentGate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!checkConsent()) return; // blocks submit without consent
    setLoading(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          source: "landing_page",
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      const data = await res.json();
      await logConsent({
        lead_id: data.lead_id,
        email: formData.email,
        phone: formData.phone,
        context: "lead",
      });
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    background: "#0f1117", border: "1px solid #2d3748", borderRadius: "8px",
    padding: "10px 14px", fontSize: "14px", color: "#e2e8f0",
    outline: "none", width: "100%", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "13px", fontWeight: "500", color: "#a0aec0",
    display: "block", marginBottom: "6px",
  };

  if (success) {
    return (
      <div style={{ background: "#1a1f2e", border: "1px solid rgba(72,187,120,0.3)", borderRadius: "12px", padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>📞</div>
        <h3 style={{ color: "#f7fafc", margin: "0 0 8px" }}>You'll receive a call shortly</h3>
        <p style={{ color: "#718096", fontSize: "14px", margin: 0 }}>
          Our AI assistant will call you within 2 minutes.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "#1a1f2e", border: "1px solid #1e2535", borderRadius: "12px", padding: "28px", maxWidth: "480px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f7fafc", margin: "0 0 6px" }}>
        Get an instant AI property consultation
      </h2>
      <p style={{ fontSize: "14px", color: "#718096", margin: "0 0 24px" }}>
        Fill in your details and receive a call in under 2 minutes.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        {[
          { id: "name", label: "Full name", type: "text", placeholder: "Your name" },
          { id: "phone", label: "Mobile number", type: "tel", placeholder: "+971 50 000 0000" },
          { id: "email", label: "Email address", type: "email", placeholder: "you@example.com" },
          { id: "location", label: "Area of interest", type: "text", placeholder: "e.g. Dubai Marina" },
        ].map(({ id, label, type, placeholder }) => (
          <div key={id} style={{ marginBottom: "16px" }}>
            <label htmlFor={id} style={labelStyle}>{label}</label>
            <input
              id={id} name={id} type={type} placeholder={placeholder}
              value={formData[id as keyof FormData]}
              onChange={handleChange} style={fieldStyle}
            />
          </div>
        ))}
        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="timeline" style={labelStyle}>When are you looking to buy / rent?</label>
          <select id="timeline" name="timeline" value={formData.timeline} onChange={handleChange} style={fieldStyle}>
            {["ASAP", "1–3 months", "3–6 months", "6+ months", "Just exploring"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <ConsentCheckbox
          checked={consentGiven}
          onChange={setConsentGiven}
          showError={showConsentError}
          context="lead"
        />
        {error && <p style={{ fontSize: "13px", color: "#f6ad55", margin: "0 0 12px" }}>{error}</p>}
        <button
          type="submit" disabled={loading}
          style={{
            width: "100%", padding: "12px",
            background: "linear-gradient(135deg,#3182ce,#553c9a)",
            color: "#fff", fontSize: "15px", fontWeight: "600",
            border: "none", borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Connecting…" : "📞 Call me now"}
        </button>
      </form>
    </div>
  );
}
