"use client";
import Link from "next/link";
import { Logo } from "./Logo";
import { useApp } from "./Providers";

export function Footer() {
  const { t } = useApp();
  return (
    <footer className="relative border-t border-line bg-[var(--band)] before:pointer-events-none before:absolute before:inset-x-0 before:-top-px before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet/50 before:to-transparent">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">{t("footer.disclaimer")}</p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">{t("nav.assessments")}</p>
          <ul className="space-y-2 text-muted">
            <li><Link className="hover:text-ink" href="/#categories">{t("nav.categories")}</Link></li>
            <li><Link className="hover:text-ink" href="/#assessments">{t("feat.title")}</Link></li>
            <li><Link className="hover:text-ink" href="/#faq">{t("nav.faq")}</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">{t("nav.signup")}</p>
          <ul className="space-y-2 text-muted">
            <li><Link className="hover:text-ink" href="/login">{t("nav.login")}</Link></li>
            <li><Link className="hover:text-ink" href="/register">{t("auth.signup")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">© {new Date().getFullYear()} INTELLIQ</div>
    </footer>
  );
}
