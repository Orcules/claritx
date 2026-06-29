import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead, BreadcrumbSchema } from "@/components/SEOHead";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Terms of Service | User Agreement | ClaritX"
        description="ClaritX Terms of Service. Read our user agreement covering the use of our AI-powered stock analysis and portfolio simulation platform."
        keywords="terms of service, user agreement, terms and conditions, legal terms, service agreement"
        canonicalUrl="/terms"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Terms of Service", url: "/terms-of-service" }
        ]}
      />
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
        <div className="max-w-4xl mx-auto prose prose-invert">
          <h1 className="text-4xl font-display font-bold text-foreground mb-8">Terms of Service</h1>
          <p className="text-muted-foreground mb-6">Last updated: December 2024</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using ClaritX ("the Service"), you confirm that you have read, understood, and agree to be bound by these Terms of Service, including our Disclaimer and Privacy Policy. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Nature of Services – Educational Analytics Platform</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              ClaritX provides AI-powered stock analysis and portfolio simulation tools for <strong>informational and educational purposes only</strong>. The Service is designed as an analytical resource to help users explore and understand publicly available financial data.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>ClaritX operates as a financial publisher and analytics platform, NOT as a regulated financial services provider:</strong>
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Not a registered investment adviser under the U.S. Investment Advisers Act of 1940</li>
              <li>Not a broker-dealer registered with the SEC or FINRA</li>
              <li>Not authorized or regulated under MiFID II (EU Markets in Financial Instruments Directive)</li>
              <li>Not authorized by the UK Financial Conduct Authority (FCA)</li>
              <li>Does not provide personalized investment recommendations as defined under Article 4(1)(4) of MiFID II</li>
              <li>Does not manage client portfolios or have discretionary authority over investments</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Our service falls under the <strong>publisher's exclusion</strong> (Section 202(a)(11)(D) of the Investment Advisers Act) as we provide bona fide, impersonal financial analysis available to all subscribers on a general basis.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. No Investment Advice – Impersonal Analysis Only</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              All stock analyses, AI insights, portfolio simulations, and other content provided by ClaritX are for <strong>general informational and educational purposes only</strong>. They do not constitute investment advice, personal recommendations, or financial planning tailored to any individual investor.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>Critical Understanding:</strong>
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>All AI-generated signals and scores are <strong>impersonal</strong> – the same analysis is available to any user querying the same data</li>
              <li>Portfolio simulation results are <strong>hypothetical</strong> and do not reflect actual trading or guarantee future outcomes</li>
              <li>Nothing on this platform constitutes an offer, solicitation, or recommendation to buy or sell any securities</li>
              <li>Using ClaritX does <strong>not</strong> create any investment adviser-client, fiduciary, or advisory relationship</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              By using ClaritX, you acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>You will perform your own independent research and due diligence before making any investment decisions</li>
              <li>You should consult with a qualified, licensed financial advisor regarding your specific situation</li>
              <li>You are solely responsible for determining if any investment strategy is suitable for your circumstances</li>
              <li>You understand that all investing involves risk, including potential loss of principal</li>
              <li>You use the Service entirely at your own risk</li>
              <li>You are at least 18 years of age and legally able to enter binding agreements</li>
              <li>You will not rely solely on ClaritX outputs for investment decisions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. AI Limitations and Data Accuracy</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              While ClaritX utilizes advanced AI models and real-time data sources, we make <strong>no representation or warranty</strong> regarding accuracy, completeness, timeliness, or reliability of any information provided.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>AI Limitations:</strong>
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>AI analyses are based on historical patterns and may not predict future performance</li>
              <li>Models cannot account for unpredictable events (political changes, black swan events)</li>
              <li>Automated signals may occasionally be incorrect or not fully comprehensive</li>
              <li>Confidence levels and scores are model estimates, not guarantees</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Stock quotes may be delayed and are provided by third-party sources. All information is provided "as is" without warranties of any kind, express or implied.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Affiliate Relationships and Compensation Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              ClaritX may receive compensation from third-party brokers or financial services when users sign up or transact through referral links on our platform. This affiliate relationship is disclosed in compliance with FTC guidelines and applicable regulations.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>Important Disclosures:</strong>
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Affiliate compensation does not influence our AI analysis or stock ratings</li>
              <li>We do not receive transaction-based fees from any trades you execute</li>
              <li>Partner broker links are provided as optional conveniences, not endorsements</li>
              <li>You are free to use any brokerage service of your choice</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by applicable law, ClaritX and its affiliates, owners, employees, and agents shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from your use of or reliance on the Service. This includes, without limitation, any financial losses incurred from investment decisions made based on information from the Service, regardless of whether we have been advised of the possibility of such damages.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content, analyses, AI outputs, algorithms, code, and other materials on ClaritX are proprietary and protected by intellectual property laws. Users may not redistribute, reproduce, reverse-engineer, or commercially exploit any content without prior written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Subscription Terms</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you purchase a subscription, you understand that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>The subscription provides access to analytical tools and data only, not guaranteed investment outcomes</li>
              <li>All subscribers receive the same impersonal analysis capabilities – no tier provides personal investment advice</li>
              <li>Fees are for software access, not for portfolio management or advisory services</li>
              <li>The service is provided "as-is" and uptime is not guaranteed</li>
              <li>Billing, renewal, and cancellation terms are as presented at purchase</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. Jurisdictional Compliance</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The content of this site is not intended for any jurisdiction where such use would violate local laws or regulations. It is your responsibility to ensure that accessing ClaritX is legal in your country.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Regional Notes:</strong> Users in the EU/EEA should note that ClaritX is not authorized under MiFID II and does not provide personal recommendations. Users in the UK should note we are not FCA-authorized. US users should note we rely on the publisher's exclusion from SEC registration.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">11. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of competent courts.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">12. Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              ClaritX reserves the right to modify these Terms of Service at any time. Significant changes will be communicated via email or website notice. Continued use of the Service after any changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">13. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms of Service, please contact us at legal@claritx.com
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
