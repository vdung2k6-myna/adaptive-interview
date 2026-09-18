import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Voice Agent History — Adaptive Interview Engine",
};

export default async function VoiceAgentHistoryPage() {
  const t = await getTranslations("voiceAgent");

  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/voice-agent"
          className="mb-4 inline-block min-h-[44px] text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {t("backToVoiceAgent")}
        </Link>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {t("historyTitle")}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("ephemeralNotice")}
          </p>
        </div>
      </div>
    </div>
  );
}
