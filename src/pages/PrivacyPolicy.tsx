import { useEffect, type ReactNode } from 'react'

const LAST_UPDATED = '29 June 2026'
const COMPANY_NAME = 'Gnanova Pro'
const PRODUCT_NAME = 'Gnanova Real Estate AI'
const CONTACT_EMAIL = 'privacy@gnanova.pro'
const WEBSITE = 'gnanova.pro'

interface Section {
  id: string
  title: string
  content: ReactNode
}

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const sections: Section[] = [
    {
      id: 'overview',
      title: '1. Overview',
      content: (
        <>
          <p>
            {COMPANY_NAME} (&quot;<strong>we</strong>&quot;, &quot;<strong>our</strong>&quot;, &quot;
            <strong>us</strong>&quot;) operates {PRODUCT_NAME} — an AI-powered real estate CRM, voice agent,
            and automation platform. This Privacy Policy explains what personal data we collect, why we collect
            it, who we share it with, and your rights under the{' '}
            <strong>
              UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL)
            </strong>{' '}
            and other applicable laws.
          </p>
          <p>
            By using our platform, you consent to the practices described here. If you do not agree, please
            discontinue use and contact us to request data deletion.
          </p>
        </>
      ),
    },
    {
      id: 'data-collected',
      title: '2. Data We Collect',
      content: (
        <>
          <p>We collect the following categories of personal data:</p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Examples</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Identity data</td>
                <td>Full name, nationality</td>
                <td>Lead forms, portal imports, open house check-in</td>
              </tr>
              <tr>
                <td>Contact data</td>
                <td>Mobile number, email address, WhatsApp ID</td>
                <td>Lead forms, VAPI calls, WhatsApp inbox</td>
              </tr>
              <tr>
                <td>Property preference data</td>
                <td>Budget, location, property type, timeline</td>
                <td>AI voice call transcripts, CRM entries</td>
              </tr>
              <tr>
                <td>Call recordings & transcripts</td>
                <td>Audio recordings, AI-generated call summaries</td>
                <td>VAPI voice agent</td>
              </tr>
              <tr>
                <td>Communication data</td>
                <td>WhatsApp messages, email threads</td>
                <td>Twilio WhatsApp integration</td>
              </tr>
              <tr>
                <td>Device & usage data</td>
                <td>IP address, browser type, pages visited</td>
                <td>Automatically collected on our website</td>
              </tr>
              <tr>
                <td>Agent/broker account data</td>
                <td>Name, role, login credentials</td>
                <td>Account signup</td>
              </tr>
            </tbody>
          </table>
        </>
      ),
    },
    {
      id: 'why-collected',
      title: '3. Why We Collect Your Data',
      content: (
        <>
          <p>We process personal data for the following purposes:</p>
          <ul>
            <li>
              <strong>Lead qualification & follow-up</strong> — to qualify property enquiries via AI voice calls
              and route leads to the right agent
            </li>
            <li>
              <strong>Property matching</strong> — to recommend relevant properties using AI-powered search
            </li>
            <li>
              <strong>WhatsApp & SMS communication</strong> — to send property listings, appointment
              confirmations, and follow-up messages
            </li>
            <li>
              <strong>CRM management</strong> — to track leads, deals, commissions, and pipeline stages
            </li>
            <li>
              <strong>Analytics & reporting</strong> — to generate conversion and performance reports for
              brokers
            </li>
            <li>
              <strong>Legal compliance</strong> — to maintain records as required by UAE real estate
              regulations (RERA/DLD)
            </li>
          </ul>
          <p>
            <strong>Legal basis:</strong> Processing is based on (a) your consent given at the point of data
            collection, (b) our legitimate interests in operating the platform, and (c) compliance with legal
            obligations.
          </p>
        </>
      ),
    },
    {
      id: 'third-parties',
      title: '4. Third Parties Who Receive Your Data',
      content: (
        <>
          <p>
            We use the following third-party services to operate the platform. Your data may be transmitted to
            and processed by these providers:
          </p>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
                <th>Data Sent</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>VAPI</strong>
                </td>
                <td>AI voice call processing</td>
                <td>Call audio, transcripts, lead contact info</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>
                  <strong>OpenAI</strong>
                </td>
                <td>AI text generation (listing writer, lead scoring)</td>
                <td>Lead preferences, property descriptions</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>
                  <strong>Twilio</strong>
                </td>
                <td>WhatsApp & SMS messaging</td>
                <td>Mobile numbers, message content</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>
                  <strong>Supabase</strong>
                </td>
                <td>Database & authentication</td>
                <td>All CRM data, user accounts</td>
                <td>United States (AWS us-east-1)</td>
              </tr>
            </tbody>
          </table>
          <p>
            All third-party providers are contractually bound to process data only for the purposes we specify.
            We do <strong>not</strong> sell your personal data to any third party.
          </p>
          <div className="notice notice--warning">
            <strong>Note on AI processing:</strong> When your enquiry is processed through our AI voice agent
            or lead scoring system, call transcripts and preference data are transmitted to VAPI and OpenAI.
            We have enabled data processing agreements with these providers to limit use of your data for model
            training purposes.
          </div>
        </>
      ),
    },
    {
      id: 'data-retention',
      title: '5. How Long We Keep Your Data',
      content: (
        <>
          <table>
            <thead>
              <tr>
                <th>Data Type</th>
                <th>Retention Period</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Lead contact information</td>
                <td>2 years from last interaction, or until deletion requested</td>
              </tr>
              <tr>
                <td>Call recordings</td>
                <td>90 days</td>
              </tr>
              <tr>
                <td>Call transcripts</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td>WhatsApp message threads</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td>Deal & commission records</td>
                <td>7 years (UAE commercial law requirement)</td>
              </tr>
              <tr>
                <td>Agent account data</td>
                <td>Duration of subscription + 90 days</td>
              </tr>
            </tbody>
          </table>
        </>
      ),
    },
    {
      id: 'your-rights',
      title: '6. Your Rights Under UAE PDPL',
      content: (
        <>
          <p>Under the UAE Personal Data Protection Law, you have the right to:</p>
          <ul>
            <li>
              <strong>Access</strong> — request a copy of the personal data we hold about you
            </li>
            <li>
              <strong>Correction</strong> — request that inaccurate data be corrected
            </li>
            <li>
              <strong>Deletion (&quot;Right to be Forgotten&quot;)</strong> — request that we delete your
              personal data, subject to legal retention obligations
            </li>
            <li>
              <strong>Withdraw consent</strong> — opt out of communications or data processing at any time
            </li>
            <li>
              <strong>Data portability</strong> — request your data in a structured, machine-readable format
            </li>
            <li>
              <strong>Object to processing</strong> — object to certain types of processing, including
              automated profiling
            </li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within{' '}
            <strong>30 days</strong>.
          </p>
        </>
      ),
    },
    {
      id: 'security',
      title: '7. Data Security',
      content: (
        <p>
          We implement industry-standard security measures including encrypted data transmission (TLS 1.2+),
          role-based access controls so agents can only access their own leads, row-level security on our
          database, and regular security reviews. In the event of a data breach affecting your personal data, we
          will notify you and the relevant UAE authority within 72 hours of becoming aware.
        </p>
      ),
    },
    {
      id: 'cookies',
      title: '8. Cookies & Tracking',
      content: (
        <p>
          Our website uses essential cookies for authentication and session management. We do not currently use
          advertising or third-party tracking cookies. You can disable cookies in your browser settings, though
          this may affect platform functionality.
        </p>
      ),
    },
    {
      id: 'children',
      title: '9. Minors',
      content: (
        <p>
          Our platform is not directed at individuals under 18 years of age. We do not knowingly collect
          personal data from minors. If you believe we have inadvertently collected such data, please contact
          us immediately for deletion.
        </p>
      ),
    },
    {
      id: 'changes',
      title: '10. Changes to This Policy',
      content: (
        <p>
          We may update this Privacy Policy from time to time. When we do, we will update the &quot;Last
          Updated&quot; date at the top of this page and notify registered users by email. Continued use of the
          platform after changes constitutes acceptance of the updated policy.
        </p>
      ),
    },
    {
      id: 'contact',
      title: '11. Contact Us',
      content: (
        <>
          <p>For any privacy-related questions, requests, or complaints:</p>
          <div className="contact-block">
            <p>
              <strong>{COMPANY_NAME}</strong>
              <br />
              Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              <br />
              Website: <a href={`https://${WEBSITE}`}>{WEBSITE}</a>
            </p>
          </div>
          <p>
            If you are not satisfied with our response, you have the right to lodge a complaint with the UAE
            Data Office at{' '}
            <a href="https://uaedataoffice.gov.ae" target="_blank" rel="noopener noreferrer">
              uaedataoffice.gov.ae
            </a>
            .
          </p>
        </>
      ),
    },
  ]

  return (
    <div className="pp-root">
      <style>{`
        .pp-root {
          min-height: 100vh;
          background: #0f1117;
          color: #e2e8f0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .pp-header {
          background: linear-gradient(135deg, #1a1f2e 0%, #0f1117 100%);
          border-bottom: 1px solid #1e2535;
          padding: 48px 24px 40px;
          text-align: center;
        }

        .pp-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(99, 179, 237, 0.1);
          border: 1px solid rgba(99, 179, 237, 0.3);
          color: #63b3ed;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 5px 12px;
          border-radius: 20px;
          margin-bottom: 20px;
        }

        .pp-header h1 {
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 700;
          color: #f7fafc;
          margin: 0 0 12px;
          letter-spacing: -0.02em;
        }

        .pp-header p {
          color: #718096;
          font-size: 14px;
          margin: 0;
        }

        .pp-layout {
          max-width: 1100px;
          margin: 0 auto;
          padding: 48px 24px 80px;
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 48px;
          align-items: start;
        }

        @media (max-width: 768px) {
          .pp-layout {
            grid-template-columns: 1fr;
            padding: 32px 16px 60px;
          }
          .pp-nav { display: none; }
        }

        .pp-nav {
          position: sticky;
          top: 24px;
        }

        .pp-nav-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #4a5568;
          margin-bottom: 12px;
        }

        .pp-nav a {
          display: block;
          font-size: 13px;
          color: #718096;
          text-decoration: none;
          padding: 6px 0 6px 12px;
          border-left: 2px solid #1e2535;
          margin-bottom: 2px;
          transition: color 0.15s, border-color 0.15s;
          line-height: 1.4;
        }

        .pp-nav a:hover {
          color: #63b3ed;
          border-color: #63b3ed;
        }

        .pp-content section {
          margin-bottom: 52px;
          padding-bottom: 52px;
          border-bottom: 1px solid #1e2535;
        }

        .pp-content section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .pp-content h2 {
          font-size: 20px;
          font-weight: 600;
          color: #f7fafc;
          margin: 0 0 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid #1e2535;
        }

        .pp-content p {
          font-size: 15px;
          line-height: 1.75;
          color: #a0aec0;
          margin: 0 0 16px;
        }

        .pp-content p:last-child {
          margin-bottom: 0;
        }

        .pp-content ul {
          margin: 0 0 16px;
          padding-left: 0;
          list-style: none;
        }

        .pp-content ul li {
          font-size: 15px;
          line-height: 1.7;
          color: #a0aec0;
          padding: 6px 0 6px 20px;
          position: relative;
        }

        .pp-content ul li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 14px;
          width: 6px;
          height: 6px;
          background: #63b3ed;
          border-radius: 50%;
        }

        .pp-content a {
          color: #63b3ed;
          text-decoration: none;
        }

        .pp-content a:hover {
          text-decoration: underline;
        }

        .pp-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 14px;
        }

        .pp-content th {
          background: #1a1f2e;
          color: #a0aec0;
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 10px 14px;
          text-align: left;
          border: 1px solid #1e2535;
        }

        .pp-content td {
          padding: 10px 14px;
          color: #a0aec0;
          border: 1px solid #1e2535;
          vertical-align: top;
          line-height: 1.6;
        }

        .pp-content tr:nth-child(even) td {
          background: rgba(255,255,255,0.02);
        }

        .notice {
          padding: 14px 18px;
          border-radius: 8px;
          margin: 20px 0;
          font-size: 14px;
          line-height: 1.65;
        }

        .notice--warning {
          background: rgba(237, 137, 54, 0.08);
          border: 1px solid rgba(237, 137, 54, 0.25);
          color: #fbd38d;
        }

        .contact-block {
          background: #1a1f2e;
          border: 1px solid #1e2535;
          border-radius: 8px;
          padding: 18px 20px;
          margin: 16px 0;
        }

        .contact-block p {
          margin: 0;
          line-height: 1.8;
        }
      `}</style>

      <div className="pp-header">
        <div className="pp-badge">🔒 UAE PDPL Compliant</div>
        <h1>Privacy Policy</h1>
        <p>
          {PRODUCT_NAME} &nbsp;·&nbsp; Last updated: {LAST_UPDATED}
        </p>
      </div>

      <div className="pp-layout">
        <nav className="pp-nav">
          <div className="pp-nav-label">Contents</div>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </nav>

        <main className="pp-content">
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.content}
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}
