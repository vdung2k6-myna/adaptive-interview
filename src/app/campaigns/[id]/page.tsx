import { db } from "@/lib/db";
import { campaigns, campaignPositions, positions, interviewSessions, candidates, evaluationVersions } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params;

  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (rows.length === 0) return notFound();
  const campaign = rows[0];

  // Positions in campaign
  const cpRows = await db
    .select({ position: positions })
    .from(campaignPositions)
    .leftJoin(positions, eq(campaignPositions.positionId, positions.id))
    .where(eq(campaignPositions.campaignId, id));

  const campaignPositionsList = cpRows.map((r) => r.position).filter(Boolean);
  const positionIds = campaignPositionsList.map((p) => p!.id);

  // Sessions for positions in campaign
  const sessionRows =
    positionIds.length > 0
      ? await db
          .select({ id: interviewSessions.id, positionId: interviewSessions.positionId, candidateId: interviewSessions.candidateId })
          .from(interviewSessions)
          .where(sql`${interviewSessions.positionId} IN (${sql.join(positionIds.map((pid) => sql`${pid}`), sql`, `)})`)
      : [];

  const sessionIds = sessionRows.map((s) => s.id);

  // Evaluations
  const evalRows =
    sessionIds.length > 0
      ? await db
          .select()
          .from(evaluationVersions)
          .where(sql`${evaluationVersions.sessionId} IN (${sql.join(sessionIds.map((sid) => sql`${sid}`), sql`, `)})`)
      : [];

  const versionMap = new Map<string, typeof evaluationVersions.$inferSelect>();
  for (const v of evalRows) {
    const existing = versionMap.get(v.sessionId);
    if (!existing || new Date(v.createdAt) > new Date(existing.createdAt)) {
      versionMap.set(v.sessionId, v);
    }
  }

  // Metrics
  let totalSessions = 0;
  let completedSessions = 0;
  let aiScoreSum = 0;
  let aiScoreCount = 0;
  let humanScoreSum = 0;
  let humanScoreCount = 0;
  const recCounts: Record<string, number> = {};

  for (const sid of sessionIds) {
    totalSessions++;
    const version = versionMap.get(sid);
    if (version) {
      completedSessions++;
      const aiScores = [version.aiTechnicalDepth, version.aiCommunicationClarity, version.aiProblemSolving, version.aiRelevanceToRole].filter((s): s is number => s !== null);
      if (aiScores.length > 0) {
        aiScoreSum += aiScores.reduce((a, b) => a + b, 0) / aiScores.length;
        aiScoreCount++;
      }
      const humanScores = [version.humanTechnicalDepth, version.humanCommunicationClarity, version.humanProblemSolving, version.humanRelevanceToRole].filter((s): s is number => s !== null);
      if (humanScores.length > 0) {
        humanScoreSum += humanScores.reduce((a, b) => a + b, 0) / humanScores.length;
        humanScoreCount++;
      }
      if (version.aiRecommendation) {
        recCounts[version.aiRecommendation] = (recCounts[version.aiRecommendation] || 0) + 1;
      }
    }
  }

  const avgAiScore = aiScoreCount > 0 ? Math.round((aiScoreSum / aiScoreCount) * 10) / 10 : null;
  const avgHumanScore = humanScoreCount > 0 ? Math.round((humanScoreSum / humanScoreCount) * 10) / 10 : null;
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Top candidates
  const candidateIds = [...new Set(sessionRows.map((s) => s.candidateId).filter(Boolean))];
  const candidateRows =
    candidateIds.length > 0
      ? await db
          .select()
          .from(candidates)
          .where(sql`${candidates.id} IN (${sql.join(candidateIds.map((cid) => sql`${cid}`), sql`, `)})`)
      : [];

  const candidateMap = new Map(candidateRows.map((c) => [c.id, c]));

  const topCandidates = sessionIds
    .map((sid) => {
      const version = versionMap.get(sid);
      if (!version) return null;
      const aiScores = [version.aiTechnicalDepth, version.aiCommunicationClarity, version.aiProblemSolving, version.aiRelevanceToRole].filter((s): s is number => s !== null);
      const humanScores = [version.humanTechnicalDepth, version.humanCommunicationClarity, version.humanProblemSolving, version.humanRelevanceToRole].filter((s): s is number => s !== null);
      const aiAvg = aiScores.length > 0 ? aiScores.reduce((a, b) => a + b, 0) / aiScores.length : null;
      const humanAvg = humanScores.length > 0 ? humanScores.reduce((a, b) => a + b, 0) / humanScores.length : null;
      const sessionRow = sessionRows.find((s) => s.id === sid);
      const candidate = sessionRow?.candidateId ? candidateMap.get(sessionRow.candidateId) : undefined;
      return {
        sessionId: sid,
        candidateName: candidate?.name || "Unknown",
        aiAvg,
        humanAvg,
        recommendation: version.aiRecommendation,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a!.humanAvg !== null && b!.humanAvg !== null) return b!.humanAvg - a!.humanAvg;
      if (a!.humanAvg !== null) return -1;
      if (b!.humanAvg !== null) return 1;
      return (b!.aiAvg || 0) - (a!.aiAvg || 0);
    })
    .slice(0, 5);

  const dateStr =
    campaign.startDate && campaign.endDate
      ? `${new Date(campaign.startDate).toLocaleDateString()} – ${new Date(campaign.endDate).toLocaleDateString()}`
      : campaign.startDate
        ? `From ${new Date(campaign.startDate).toLocaleDateString()}`
        : campaign.endDate
          ? `Until ${new Date(campaign.endDate).toLocaleDateString()}`
          : "No dates set";

  const statusColor =
    campaign.status === "active"
      ? "text-emerald-600 dark:text-emerald-400"
      : campaign.status === "archived"
        ? "text-zinc-500 dark:text-zinc-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link href="/campaigns" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline">
            ← Back to Campaigns
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{campaign.name}</h1>
              {campaign.description && (
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{campaign.description}</p>
              )}
            </div>
            <span className={`text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 ${statusColor}`}>
              {campaign.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <span>{dateStr}</span>
            {campaign.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {campaign.tags.map((t) => (
                  <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Sessions</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{totalSessions}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Completion Rate</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{completionRate}%</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Avg AI Score</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{avgAiScore ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Avg Human Score</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{avgHumanScore ?? "—"}</p>
          </div>
        </div>

        {Object.keys(recCounts).length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">AI Recommendation Distribution</h2>
            <div className="space-y-2">
              {Object.entries(recCounts).map(([rec, count]) => (
                <div key={rec} className="flex items-center gap-3">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 w-32">{rec}</span>
                  <div className="flex-1 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-900 dark:bg-zinc-50"
                      style={{ width: `${completedSessions > 0 ? (count / completedSessions) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topCandidates.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Top Candidates</h2>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">AI Score</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Human Score</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {topCandidates.map((tc) => (
                    <tr key={tc!.sessionId}>
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50 font-medium">
                        <Link href={`/interview/${tc!.sessionId}`} className="hover:underline">
                          {tc!.candidateName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{tc!.aiAvg?.toFixed(1) ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{tc!.humanAvg?.toFixed(1) ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{tc!.recommendation || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Positions</h2>
          {campaignPositionsList.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No positions in this campaign.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Title</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Level</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Requirements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {campaignPositionsList.map((p) => (
                    <tr key={p!.id}>
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50 font-medium">
                        <Link href={`/positions/${p!.id}/edit`} className="hover:underline">{p!.title}</Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{p!.level}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        <div className="flex flex-wrap gap-1">
                          {p!.requirements.map((r) => (
                            <span key={r} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
