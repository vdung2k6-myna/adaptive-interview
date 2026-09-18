"use client";

import { usePathname, useRouter } from "next/navigation";
import { routing } from "@/i18n/routing";

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  // Extract current locale from pathname (e.g., /en/dashboard → en)
  const currentLocale = pathname.split("/")[1] || routing.defaultLocale;

  function switchLocale(locale: string) {
    if (locale === currentLocale) return;

    // Replace the locale segment in the pathname
    const segments = pathname.split("/");
    segments[1] = locale;
    const newPath = segments.join("/");
    router.push(newPath);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800">
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchLocale(locale)}
          className={`rounded-md px-2 py-1 font-medium transition-colors ${
            locale === currentLocale
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          }`}
          aria-label={`Switch to ${locale === "en" ? "English" : "Vietnamese"}`}
        >
          {locale === "en" ? "EN" : "VI"}
        </button>
      ))}
    </div>
  );
}
