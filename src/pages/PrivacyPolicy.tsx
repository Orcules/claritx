import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead, BreadcrumbSchema } from "@/components/SEOHead";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Privacy Policy | Data Protection | ClaritX"
        description="ClaritX Privacy Policy. Learn how we collect, use, and protect your personal data in compliance with GDPR, CCPA, and other privacy regulations."
        keywords="privacy policy, data protection, GDPR, CCPA, personal data, user privacy"
        canonicalUrl="/privacy"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Privacy Policy", url: "/privacy-policy" }
        ]}
      />
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
        <div className="max-w-4xl mx-auto prose prose-invert">
          <h1 className="text-4xl font-display font-bold text-foreground mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-6">Last updated: December 2024</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              ClaritX ("we," "our," or "us") is committed to protecting your privacy in accordance with the EU General Data Protection Regulation (GDPR), California Consumer Privacy Act (CCPA/CPRA), and other applicable data protection laws. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered stock analysis and portfolio simulation service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-foreground mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-4">
              <li>Account registration information (email address, name)</li>
              <li>Risk profile questionnaire responses (investment goals, risk tolerance preferences)</li>
              <li>Portfolio simulation preferences and saved configurations</li>
              <li>Stock search history and analysis requests</li>
              <li>Payment information (processed securely by third-party payment providers – we do not store card details)</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mb-3">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Device information (browser type, operating system, device identifiers)</li>
              <li>IP address and approximate geographic location</li>
              <li>Usage data (pages visited, features used, time spent, interaction patterns)</li>
              <li>Cookies and similar tracking technologies (see Section 6)</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mb-3">2.3 Legal Basis for Processing (GDPR)</h3>
            <p className="text-muted-foreground leading-relaxed">
              We process your personal data based on: (a) your consent, (b) performance of our contract with you, (c) compliance with legal obligations, or (d) our legitimate interests in improving and securing our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We use collected information for the following purposes:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Service Provision:</strong> Delivering stock analysis, portfolio simulation tools, and personalized dashboard views</li>
              <li><strong>Service Improvement:</strong> Analyzing usage patterns to enhance AI algorithms and user experience</li>
              <li><strong>Transaction Processing:</strong> Managing subscriptions and processing payments</li>
              <li><strong>Communication:</strong> Sending service updates, security alerts, and (with consent) marketing communications</li>
              <li><strong>Security:</strong> Detecting and preventing fraud, unauthorized access, and abuse</li>
              <li><strong>Legal Compliance:</strong> Meeting regulatory obligations and responding to lawful requests</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. AI Processing and Automated Analysis</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our service uses AI algorithms to analyze stocks and generate portfolio simulations. Important information about this processing:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>AI processes use <strong>publicly available market data</strong>, news, and financial metrics – not your personal investment accounts</li>
              <li>AI outputs are <strong>impersonal and educational</strong> – the same analysis is available to any user querying the same data</li>
              <li>We do <strong>not</strong> make automated decisions that produce legal effects concerning you</li>
              <li>You retain full control over any investment decisions you make</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Under GDPR Article 22, you have the right to human review of significant automated decisions. Since our AI provides informational analysis only (not binding decisions), this primarily applies to account-related automated processes, for which you may contact us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Information Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>We do not sell your personal information.</strong> We may share information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Third-party vendors assisting with hosting, analytics, payment processing, and customer support (under data processing agreements)</li>
              <li><strong>Affiliate Partners:</strong> When you click broker referral links, the broker may receive your referral source (no personal data is shared without your action)</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect our legal rights</li>
              <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or sale of assets (with notice to you)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Cookies and Tracking Technologies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies and similar technologies for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Essential Cookies:</strong> Required for the service to function (authentication, security)</li>
              <li><strong>Analytics Cookies:</strong> To understand usage patterns and improve the service</li>
              <li><strong>Preference Cookies:</strong> To remember your settings and preferences</li>
              <li><strong>Affiliate Tracking:</strong> To attribute referrals to partner brokers (disclosed in our Terms)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Your Choices:</strong> You can manage cookies through your browser settings. EU users will see a cookie consent banner allowing granular control. Disabling non-essential cookies will not affect core functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures, including encryption in transit and at rest, access controls, and regular security assessments. However, no electronic transmission or storage method is 100% secure. In the event of a data breach affecting your personal information, we will notify you and relevant authorities as required by GDPR and applicable laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Your Privacy Rights</h2>
            
            <h3 className="text-lg font-semibold text-foreground mb-3">GDPR Rights (EU/EEA/UK Users)</h3>
            <p className="text-muted-foreground leading-relaxed mb-2">Under GDPR, you have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Restriction:</strong> Limit how we process your data</li>
              <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Withdraw Consent:</strong> Withdraw previously given consent at any time</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To exercise these rights, contact privacy@claritx.com. We will respond within 30 days. You also have the right to lodge a complaint with your local Data Protection Authority.
            </p>

            <h3 className="text-lg font-semibold text-foreground mb-3">CCPA/CPRA Rights (California Residents)</h3>
            <p className="text-muted-foreground leading-relaxed mb-2">Under California law, you have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-4">
              <li><strong>Know:</strong> What personal information we collect and how it's used</li>
              <li><strong>Delete:</strong> Request deletion of your personal information</li>
              <li><strong>Correct:</strong> Request correction of inaccurate information</li>
              <li><strong>Opt-Out:</strong> Opt out of sale or sharing of personal information (we do not sell data)</li>
              <li><strong>Non-Discrimination:</strong> Equal service regardless of exercising privacy rights</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              We honor the Global Privacy Control (GPC) signal. To submit a request, contact privacy@claritx.com or use the "Do Not Sell or Share My Personal Information" link in our footer.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information only as long as necessary for the purposes described in this policy. Account data is retained until you request deletion. After account deletion, we may retain anonymized usage data for analytics. Legal and tax records are retained as required by applicable law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information may be transferred to and processed in countries other than your own. For transfers from the EU/EEA/UK, we rely on the EU-US Data Privacy Framework, Standard Contractual Clauses, or other lawful transfer mechanisms to ensure adequate protection of your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">11. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we learn we have collected information from a minor, we will delete it promptly. Parents who believe their child has provided information to us should contact privacy@claritx.com.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">12. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. Significant changes will be communicated via email or prominent website notice. The "Last updated" date at the top indicates the most recent revision. Continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about this Privacy Policy, to exercise your privacy rights, or to contact our Data Protection Officer, reach us at:
              <br /><br />
              <strong>Email:</strong> privacy@claritx.com<br />
              <strong>Subject Line:</strong> Privacy Request – [Your Request Type]
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
