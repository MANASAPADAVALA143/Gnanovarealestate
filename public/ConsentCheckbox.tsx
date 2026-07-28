import { useState } from "react";

// ─── Types ───────────────────────────────────────────────
interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  showError?: boolean;
  context?: "lead" | "demo" | "openhouse";
}

export interface ConsentRecord {
  lead_id?: string;
  email?: string;
  phone?: string;
  context: "lead" | "demo" | "openhouse";
}

// ─── Consent text per context ────────────────────────────
const CONSENT_TEXT: Record<string, string> = {
  lead: `I agree to be contacted by a Gnanova AI voice agent and human agents about my property enquiry. My name, phone number, and preferences will be stored and may be shared with VAPI (call processing) and Twilio (WhatsApp). I have read the Privacy Policy and consent to my data being processed.`,
  demo: `I agree that my name, email, and company details will be used to schedule and follow up on this demo. I have read the Privacy Policy and consent to my data being processed by Gnanova Pro.`,
  openhouse: `I consent to Gnanova collecting my contact information for post-event follow-up via WhatsApp, SMS, or phone call. I have read the Privacy Policy.`,
};

// ─── ConsentCheckbox component ───────────────────────────
export function ConsentCheckbox({
  checked,
  onChange,
  showError = false,
  context = "lead",
}: ConsentCheckboxProps) {
  const hasError = showError && !checked;

  return (
    <div
      style={{
        margin: "16px 0",
        padding: "14px 16px",
        borderRadius: "8px",
        background: hasError ? "rgba(252,129,74,0.05)" : "rgba(99,179,237,0.05)",
        border: `1px solid ${hasError ? "rgba(252,129,74,0.5)" : "rgba(99,179,237,0.2)"}`,
        transition: "border-color 0.15s",
      }}
    >
      <label
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            marginTop: "3px",
            width: "16px",
            height: "16px",
            flexShrink: 0,
            accentColor: "#63b3ed",
            cursor: "pointer",
          }}
        />
        <span style={{ fontSize: "13px", lineHeight: "1.6", color: "#a0aec0" }}>
          {CONSENT_TEXT[context]}{" "}
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#63b3ed" }}
          >
            View Privacy Policy
          </a>
        </span>
      </label>
      {hasError && (
        <p style={{ margin: "8px 0 0 26px", fontSize: "12px", color: "#f6ad55" }}>
          You must agree before submitting.
        </p>
      )}
    </div>
  );
}

// ─── useConsentGate hook ──────────────────────────────────
// Pass in your supabase client so this hook has no import dependency
export function useConsentGate(supabaseClient?: any) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);

  function checkConsent(): boolean {
    if (!consentGiven) {
      setShowConsentError(true);
      return false;
    }
    return true;
  }

  async function logConsent(record: ConsentRecord): Promise<void> {
    if (!supabaseClient) return;
    try {
      await supabaseClient.from("consent_log").insert({
        ...record,
        consented_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
      });
    } catch (err) {
      console.warn("Consent log failed (non-blocking):", err);
    }
  }

  return {
    consentGiven,
    setConsentGiven,
    showConsentError,
    checkConsent,
    logConsent,
  };
}
