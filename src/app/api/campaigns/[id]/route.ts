import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignPositions, positions, interviewSessions, evaluationVersions } from "@/lib/schema";
import { eq, count, sql } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, id));
    if (rows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const campaign = rows[0];

    // Get positions in this campaign
    const cpRows = await db
      .select({
        position: positions,
      })
      .from(campaignPositions)
      .leftJoin(positions, eq(campaignPositions.positionId, positions.id))
      .where(eq(campaignPositions.campaignId, id));

    const campaignPositionsList = cpRows.map((r) => r.position).filter(Boolean);

    // Count sessions per position in campaign
    const positionIds = campaignPositionsList.map((p) => p!.id);
    const sessionCounts =
      positionIds.length > 0
        ? await db
            .select({
              positionId: interviewSessions.positionId,
              count: count(),
            })
            .from(interviewSessions)
            .where(sql`${interviewSessions.positionId} IN (${sql.join(positionIds.map((pid) => sql`${pid}`), sql`, `)})`)
            .groupBy(interviewSessions.positionId)
        : [];

    const sessionCountMap = new Map(sessionCounts.map((s) => [s.positionId, s.count]));

    // Get all session IDs for positions in this campaign
    const sessionRows =
      positionIds.length > 0
        ? await db
            .select({ id: interviewSessions.id })
            .from(interviewSessions)
            .where(sql`${interviewSessions.positionId} IN (${sql.join(positionIds.map((pid) => sql`${pid}`), sql`, `)})`)
        : [];

    const sessionIds = sessionRows.map((s) => s.id);

    // Fetch evaluations for report
    const evalRows =
      sessionIds.length > 0
        ? await db
            .select()
            .from(evaluationVersions)
            .where(sql`${evaluationVersions.sessionId} IN (${sql.join(sessionIds.map((sid) => sql`${sid}`), sql`, `)})`)
        : [];

    // Pick latest version per session
    const versionMap = new Map<string, typeof evaluationVersions.$inferSelect>();
    for (const v of evalRows) {
      const existing = versionMap.get(v.sessionId);
      if (!existing || new Date(v.createdAt) > new Date(existing.createdAt)) {
        versionMap.set(v.sessionId, v);
      }
    }

    // Calculate metrics
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

    // Top candidates (by human score, fallback to AI)
    const topCandidates = sessionIds
      .map((sid) => {
        const version = versionMap.get(sid);
        if (!version) return null;
        const aiScores = [version.aiTechnicalDepth, version.aiCommunicationClarity, version.aiProblemSolving, version.aiRelevanceToRole].filter((s): s is number => s !== null);
        const humanScores = [version.humanTechnicalDepth, version.humanCommunicationClarity, version.humanProblemSolving, version.humanRelevanceToRole].filter((s): s is number => s !== null);
        const aiAvg = aiScores.length > 0 ? aiScores.reduce((a, b) => a + b, 0) / aiScores.length : null;
        const humanAvg = humanScores.length > 0 ? humanScores.reduce((a, b) => a + b, 0) / humanScores.length : null;
        return {
          sessionId: sid,
          aiAvg,
          humanAvg,
          recommendation: version.aiRecommendation,
          humanRecommendation: version.humanRecommendation,
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

    const report = {
      totalSessions,
      completedSessions,
      completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
      avgAiScore: aiScoreCount > 0 ? Math.round((aiScoreSum / aiScoreCount) * 10) / 10 : null,
      avgHumanScore: humanScoreCount > 0 ? Math.round((humanScoreSum / humanScoreCount) * 10) / 10 : null,
      recommendationCounts: recCounts,
      topCandidates,
    };

    return NextResponse.json({
      campaign,
      positions: campaignPositionsList.map((p) => ({
        ...p,
        sessionCount: sessionCountMap.get(p!.id) || 0,
      })),
      report,
    });
  } catch (err) {
    console.error("GET /api/campaigns/:id error:", err);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, startDate, endDate, tags, status } = body;

    const updateValues: Partial<typeof campaigns.$inferInsert> = {};
    if (name !== undefined) updateValues.name = String(name).trim();
    if (description !== undefined) updateValues.description = description ? String(description).trim() : null;
    if (startDate !== undefined) updateValues.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateValues.endDate = endDate ? new Date(endDate) : null;
    if (tags !== undefined) updateValues.tags = Array.isArray(tags) ? tags.map((t: unknown) => String(t).trim()).filter(Boolean) : [];
    if (status !== undefined) updateValues.status = String(status);

    const [updated] = await db.update(campaigns).set(updateValues).where(eq(campaigns.id, id)).returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/campaigns/:id error:", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(campaigns).where(eq(campaigns.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/campaigns/:id error:", err);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
