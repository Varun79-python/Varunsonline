import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Varun\'s Online',
  description: 'Privacy policy for Varun\'s Online local shopping platform.',
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>
        <Link
          href="/login"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: '#f97316', fontWeight: 600, fontSize: '0.9rem',
            textDecoration: 'none', marginBottom: 24,
          }}
        >
          ← Back to login
        </Link>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 32 }}>Last updated: June 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Section title="1. Information We Collect">
            We collect information you provide when creating an account, placing orders, or contacting
            support. This includes your name, email address, phone number, delivery address, payment
            information, and profile details such as gender.
          </Section>

          <Section title="2. Location Information">
            With your consent, we collect precise GPS location data to: (a) show nearby shops and
            delivery options; (b) enable delivery tracking; and (c) verify shop locations. You can
            disable location access in your device settings, though some features may not work correctly.
          </Section>

          <Section title="3. How We Use Your Information">
            We use your information to: (a) process and deliver orders; (b) communicate order updates;
            (c) improve our services; (d) prevent fraud and abuse; (e) comply with legal obligations;
            and (f) send relevant notifications with your consent.
          </Section>

          <Section title="4. Information Sharing">
            We share necessary information with: (a) shops to fulfill your orders; (b) delivery agents
            for pickup and delivery; (c) payment processors for transaction processing; and
            (d) service providers who help us operate the platform. We never sell your personal
            information to third parties.
          </Section>

          <Section title="5. Data Security">
            We implement industry-standard security measures including encryption in transit (TLS),
            secure authentication, and regular security audits. However, no online platform can
            guarantee 100% security.
          </Section>

          <Section title="6. Data Retention">
            We retain your account information for as long as your account is active. Order history
            is retained for record-keeping and legal compliance. You may request deletion of your
            account and associated data by contacting support.
          </Section>

          <Section title="7. Your Rights">
            You have the right to: (a) access your personal data; (b) correct inaccurate data;
            (c) delete your data (subject to legal requirements); (d) restrict processing; and
            (e) data portability. To exercise these rights, contact us at support@varunsonline.com.
          </Section>

          <Section title="8. Cookies and Tracking">
            We use essential cookies for authentication and platform functionality. Analytics cookies
            help us understand usage patterns. You can control cookie preferences through your
            browser settings.
          </Section>

          <Section title="9. Third-Party Services">
            Our platform integrates with third-party services including payment gateways (Razorpay),
            mapping services (Google Maps), and analytics providers. These services have their own
            privacy policies governing data handling.
          </Section>

          <Section title="10. Children&apos;s Privacy">
            Our platform is not directed to individuals under 18. We do not knowingly collect
            personal information from minors. If you believe a minor has provided us with personal
            data, please contact us immediately.
          </Section>

          <Section title="11. Changes to This Policy">
            We may update this Privacy Policy periodically. Material changes will be communicated
            via email or platform notifications. We encourage you to review this policy regularly.
          </Section>

          <Section title="12. Contact Us">
            For privacy-related inquiries, please contact us at:
            <br />Email: support@varunsonline.com
            <br />Address: Varun&apos;s Online, Vizag, Andhra Pradesh, India
            <br />We will respond to your inquiry within 48 hours.
          </Section>
        </div>
      </div>

      <style>{`
        body { margin: 0; }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.7, margin: 0 }}>{children}</p>
    </div>
  )
}
