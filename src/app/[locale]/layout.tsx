import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import MobileNav from "@/components/MobileNav";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { routing } from "@/i18n/routing";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();
  const t = await getTranslations("nav");

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <nav className="relative border-b border-zinc-200 bg-white px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 hover:opacity-80">
            {t("appName")}
          </Link>
          <div className="hidden items-center gap-4 text-sm md:flex">
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              {t("dashboard")}
            </Link>
            <Link href="/setup" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              {t("newInterview")}
            </Link>
            <Link href="/positions" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              {t("positions")}
            </Link>
            <Link href="/candidates" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              {t("candidates")}
            </Link>
            <Link href="/campaigns" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              {t("campaigns")}
            </Link>
            <Link href="/voice-agent" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              {t("voiceAgent")}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <MobileNav />
          </div>
        </div>
      </nav>
      {children}
    </NextIntlClientProvider>
  );
}
