import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interviewSessions, candidates, positions, evaluationVersions } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const positionId = searchParams.get("positionId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) {
      conditions.push(sql`${interviewSessions.status} = ${status}`);
    }
    if (positionId) {
      conditions.push(sql`${interviewSessions.positionId} = ${positionId}`);
    }

    const whereClause =
      conditions.length > 0
        ? sql.join(conditions, sql` AND `)
        : sql`TRUE`;

    const sessionRows = await db
      .select({
        session: interviewSessions,
        candidate: candidates,
        position: positions,
      })
      .from(interviewSessions)
      .leftJoin(candidates, eq(interviewSessions.candidateId, candidates.id))
      .leftJoin(positions, eq(interviewSessions.positionId, positions.id))
      .where(whereClause)
      .orderBy(desc(interviewSessions.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch latest evaluation versions for sessions
    const sessionIds = sessionRows.map((r) => r.session.id);
    const versionRows =
      sessionIds.length > 0
        ? await db
            .select()
            .from(evaluationVersions)
            .where(sql`${evaluationVersions.sessionId} IN (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];

    // Pick latest version per session
    const versionMap = new Map<string, typeof evaluationVersions.$inferSelect>();
    for (const v of versionRows) {
      const existing = versionMap.get(v.sessionId);
      if (!existing || new Date(v.createdAt) > new Date(existing.createdAt)) {
        versionMap.set(v.sessionId, v);
      }
    }

    const results = sessionRows.map((row) => {
      const version = versionMap.get(row.session.id);
      return {
        id: row.session.id,
        status: row.session.status,
        maxTurns: row.session.maxTurns,
        currentTurn: row.session.currentTurn,
        createdAt: row.session.createdAt,
        completedAt: row.session.completedAt,
        candidate: row.candidate
          ? {
              id: row.candidate.id,
              name: row.candidate.name,
              email: row.candidate.email,
            }
          : null,
        position: row.position
          ? {
              id: row.position.id,
              title: row.position.title,
              level: row.position.level,
              jobDescription: row.position.jobDescription,
            }
          : null,
        evaluation: version
          ? {
              overallScore: calculateAiOverall(version),
              humanOverallScore: calculateHumanOverall(version),
              recommendation: version.aiRecommendation,
              humanCalibrated: version.humanCalibrated,
            }
          : null,
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/sessions error:", err);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

function calculateAiOverall(version: typeof evaluationVersions.$inferSelect): number | null {
  const scores = [
    version.aiTechnicalDepth,
    version.aiCommunicationClarity,
    version.aiProblemSolving,
    version.aiRelevanceToRole,
  ].filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function calculateHumanOverall(version: typeof evaluationVersions.$inferSelect): number | null {
  const scores = [
    version.humanTechnicalDepth,
    version.humanCommunicationClarity,
    version.humanProblemSolving,
    version.humanRelevanceToRole,
  ].filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { positionId, candidateId } = body;

    if (!positionId || !candidateId) {
      return NextResponse.json(
        { error: "positionId and candidateId are required" },
        { status: 400 }
      );
    }

    const session = await db
      .insert(interviewSessions)
      .values({
        positionId,
        candidateId,
        status: "created",
        maxTurns: 8,
        currentTurn: 0,
      })
      .returning();

    return NextResponse.json(session[0], { status: 201 });
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
