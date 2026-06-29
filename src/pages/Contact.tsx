import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead, BreadcrumbSchema } from "@/components/SEOHead";
import { Mail, Twitter, MessageSquare } from "lucide-react";

export default function Contact() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Contact ClaritX | Get in Touch"
        description="Contact the ClaritX team for general questions, feedback, or business inquiries. Reach us at info@claritx.ai or business@claritx.ai."
        canonicalUrl="/contact"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Contact", url: "/contact" },
        ]}
      />
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Contact Us</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Have a question, feedback, or a business inquiry? We'd love to hear from you.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            {/* General */}
            <a
              href="mailto:info@claritx.ai"
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">General & Support</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Questions, feedback, bug reports, or anything else.
                </p>
                <p className="text-sm font-medium text-primary group-hover:underline">
                  info@claritx.ai
                </p>
              </div>
            </a>

            {/* Business */}
            <a
              href="mailto:business@claritx.ai"
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Business & Partnerships</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Press, partnerships, integrations, and commercial inquiries.
                </p>
                <p className="text-sm font-medium text-primary group-hover:underline">
                  business@claritx.ai
                </p>
              </div>
            </a>
          </div>

          {/* Twitter */}
          <div className="text-center border-t border-border/40 pt-8">
            <p className="text-muted-foreground text-sm mb-3">You can also reach us on X (Twitter)</p>
            <a
              href="https://x.com/Clarit_X"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Twitter className="h-4 w-4" />
              @Clarit_X
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
