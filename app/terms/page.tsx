import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — Varun\'s Online',
  description: 'Terms and conditions for using Varun\'s Online local shopping platform.',
}

export default function TermsPage() {
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

        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 32 }}>Last updated: June 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Section title="1. Acceptance of Terms">
            By accessing or using Varun&apos;s Online (&quot;the Platform&quot;), you agree to be bound by these Terms of Service.
            If you do not agree, please do not use the Platform.
          </Section>

          <Section title="2. Description of Service">
            Varun&apos;s Online is a local commerce platform that connects customers with local shops,
            restaurants, and service providers. We facilitate ordering, payments, and delivery of products
            and services through our platform.
          </Section>

          <Section title="3. User Accounts">
            You are responsible for maintaining the confidentiality of your account credentials and for all
            activities that occur under your account. You must provide accurate, current, and complete
            information during the registration process.
          </Section>

          <Section title="4. Customer Responsibilities">
            As a customer, you agree to: (a) provide accurate delivery information; (b) pay for all orders
            placed through your account; (c) not misuse the platform for fraudulent purposes; and
            (d) treat delivery agents and shop staff with respect.
          </Section>

          <Section title="5. Shop Owner Responsibilities">
            As a shop owner, you agree to: (a) maintain accurate product listings and pricing; (b) fulfill
            orders in a timely manner; (c) maintain food safety and product quality standards; and
            (d) comply with all applicable local laws and regulations.
          </Section>

          <Section title="6. Delivery Agent Responsibilities">
            As a delivery agent, you agree to: (a) maintain valid documentation; (b) deliver orders promptly
            and accurately; (c) handle customer payments responsibly; and (d) follow traffic laws and
            safety guidelines.
          </Section>

          <Section title="7. Payments and Fees">
            All payments are processed securely through our payment partners. Platform fees are clearly
            displayed before order confirmation. Shop owners agree to pay applicable commission fees
            on completed orders. Refunds are handled in accordance with our refund policy.
          </Section>

          <Section title="8. Cancellations and Refunds">
            Customers may cancel orders before the shop begins preparation. Once accepted by the shop,
            cancellations are subject to the shop&apos;s policy. Refunds for cancelled or failed deliveries
            will be processed within 5-7 business days.
          </Section>

          <Section title="9. Limitation of Liability">
            Varun&apos;s Online acts as an intermediary platform and is not liable for: (a) product quality
            or accuracy of listings; (b) delays caused by weather, traffic, or unforeseen circumstances;
            (c) disputes between users; or (d) indirect or consequential damages.
          </Section>

          <Section title="10. Privacy">
            Your use of the Platform is also governed by our Privacy Policy. Please review it to
            understand how we collect, use, and protect your personal information.
          </Section>

          <Section title="11. Termination">
            We reserve the right to suspend or terminate accounts that violate these terms, engage in
            fraudulent activity, or disrupt the platform experience for other users.
          </Section>

          <Section title="12. Changes to Terms">
            We may update these terms from time to time. Users will be notified of material changes
            via email or platform notification. Continued use after changes constitutes acceptance.
          </Section>

          <Section title="13. Contact">
            For questions about these terms, please contact us at support@varunsonline.com or
            reach out through our customer support channels on the platform.
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
