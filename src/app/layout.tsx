import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import "../styles/theme.css";
import "../styles/shell.css";
import "../styles/report.css";
import "../styles/three.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import LangSwitch from "@/components/LangSwitch";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/server/session";
import MobileMenu from "@/components/shell/MobileMenu";

export const metadata: Metadata = {
  title: "Húsrýni — ástandsskýrslur",
  description: "AI-assisted, inspector-verified home condition reports for the Icelandic property market.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// latin-ext covers Icelandic (ð, þ, æ, ö). Self-hosted by next/font, no runtime request to Google.
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = getDict(lang);
  return (
    <html lang={lang} className={inter.variable} data-scroll-behavior="smooth">
      <body className="d-flex flex-column min-vh-100 bg-body">
        <header className="sh-nav no-print">
          <div className="container sh-nav-inner">
            <Link className="sh-brand" href="/">
              <span className="sh-brand-mark" aria-hidden>
                <i className="bi bi-house-check" />
              </span>
              <span className="sh-brand-name">{t.brand}</span>
              <span className="sh-proto">{t.prototypeBadge}</span>
            </Link>
            <nav className="sh-nav-links" aria-label={t.shNavMenu}>
              <Link href="/#how" className="sh-nav-link">
                {t.navHow}
              </Link>
              <Link href="/#pricing" className="sh-nav-link">
                {t.navPricing}
              </Link>
              <Link href="/inspector" className="sh-nav-link">
                {t.navInspector}
              </Link>
            </nav>
            <div className="sh-nav-actions">
              <LangSwitch lang={lang} />
              <Link href="/inspections/new" className="btn btn-primary sh-nav-cta">
                {t.navStart}
              </Link>
              <MobileMenu label={t.shNavMenu}>
                <Link href="/#how" className="sh-menu-link">
                  {t.navHow}
                  <i className="bi bi-chevron-right" aria-hidden />
                </Link>
                <Link href="/#pricing" className="sh-menu-link">
                  {t.navPricing}
                  <i className="bi bi-chevron-right" aria-hidden />
                </Link>
                <Link href="/inspector" className="sh-menu-link">
                  {t.navInspector}
                  <i className="bi bi-chevron-right" aria-hidden />
                </Link>
                <Link href="/inspections/new" className="btn btn-primary btn-lg w-100 sh-menu-cta">
                  <i className="bi bi-camera me-2" aria-hidden />
                  {t.navStart}
                </Link>
              </MobileMenu>
            </div>
          </div>
        </header>
        <main className="flex-grow-1">{children}</main>
        <footer className="sh-footer no-print">
          <div className="container">
            <div className="sh-footer-top">
              <div className="sh-footer-about">
                <Link className="sh-brand" href="/">
                  <span className="sh-brand-mark" aria-hidden>
                    <i className="bi bi-house-check" />
                  </span>
                  <span className="sh-brand-name">{t.brand}</span>
                </Link>
                <p className="sh-footer-tagline">{t.tagline}</p>
                <Link href="/inspections/new" className="btn btn-primary sh-footer-cta">
                  {t.navStart}
                  <i className="bi bi-arrow-right ms-2" aria-hidden />
                </Link>
              </div>
              <nav className="sh-footer-col" aria-labelledby="sh-footer-product">
                <p id="sh-footer-product" className="sh-footer-heading">
                  {t.shFooterProduct}
                </p>
                <ul>
                  <li>
                    <Link href="/#how">{t.navHow}</Link>
                  </li>
                  <li>
                    <Link href="/#grades">{t.shGradesTitle}</Link>
                  </li>
                  <li>
                    <Link href="/#pricing">{t.navPricing}</Link>
                  </li>
                  <li>
                    <Link href="/#faq">{t.faqTitle}</Link>
                  </li>
                </ul>
              </nav>
              <nav className="sh-footer-col" aria-labelledby="sh-footer-pros">
                <p id="sh-footer-pros" className="sh-footer-heading">
                  {t.shFooterPros}
                </p>
                <ul>
                  <li>
                    <Link href="/inspector">{t.navInspector}</Link>
                  </li>
                  <li>
                    <Link href="/#pricing">{t.shFooterAgencies}</Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="sh-footer-bottom">
              <p className="sh-footer-disclaimer">
                <i className="bi bi-info-circle" aria-hidden />
                <span>{t.footerDisclaimer}</span>
              </p>
              <p className="sh-footer-copy">
                <span>
                  © {new Date().getFullYear()} {t.brand}
                </span>
                <span className="sh-proto">{t.prototypeBadge}</span>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
