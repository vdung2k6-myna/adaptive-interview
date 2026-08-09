import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluationVersions } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const versions = await db
      .select()
      .from(evaluationVersions)
      .where(eq(evaluationVersions.sessionId, sessionId))
      .orderBy(desc(evaluationVersions.createdAt));

    if (versions.length === 0) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const latest = versions[0];

    return NextResponse.json({
      latest: {
        id: latest.id,
        sessionId: latest.sessionId,
        model: latest.model,
        aiScores: {
          technicalDepth: latest.aiTechnicalDepth,
          communicationClarity: latest.aiCommunicationClarity,
          problemSolving: latest.aiProblemSolving,
          relevanceToRole: latest.aiRelevanceToRole,
        },
        humanScores: {
          technicalDepth: latest.humanTechnicalDepth,
          communicationClarity: latest.humanCommunicationClarity,
          problemSolving: latest.humanProblemSolving,
          relevanceToRole: latest.humanRelevanceToRole,
        },
        aiRecommendation: latest.aiRecommendation,
        humanRecommendation: latest.humanRecommendation,
        humanCalibrated: latest.humanCalibrated,
        confidence: latest.aiConfidence,
        strengths: latest.strengths,
        weaknesses: latest.weaknesses,
        recruiterNotes: latest.recruiterNotes,
        rawResponse: latest.rawResponse,
        createdAt: latest.createdAt,
      },
      versions: versions.map((v) => ({
        id: v.id,
        model: v.model,
        humanCalibrated: v.humanCalibrated,
        createdAt: v.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/evaluations/[sessionId] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch evaluation" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await req.json();
    const {
      humanScores,
      humanRecommendation,
      recruiterNotes,
    }: {
      humanScores?: {
        technicalDepth?: number;
        communicationClarity?: number;
        problemSolving?: number;
        relevanceToRole?: number;
      };
      humanRecommendation?: string;
      recruiterNotes?: string;
    } = body;

    // Find the latest version for this session
    const versions = await db
      .select()
      .from(evaluationVersions)
      .where(eq(evaluationVersions.sessionId, sessionId))
      .orderBy(desc(evaluationVersions.createdAt))
      .limit(1);

    if (versions.length === 0) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const latest = versions[0];

    const updateData: Partial<typeof evaluationVersions.$inferInsert> = {};

    if (humanScores) {
      if (humanScores.technicalDepth !== undefined)
        updateData.humanTechnicalDepth = humanScores.technicalDepth;
      if (humanScores.communicationClarity !== undefined)
        updateData.humanCommunicationClarity = humanScores.communicationClarity;
      if (humanScores.problemSolving !== undefined)
        updateData.humanProblemSolving = humanScores.problemSolving;
      if (humanScores.relevanceToRole !== undefined)
        updateData.humanRelevanceToRole = humanScores.relevanceToRole;
    }

    if (humanRecommendation !== undefined) {
      updateData.humanRecommendation = humanRecommendation;
    }

    if (recruiterNotes !== undefined) {
      updateData.recruiterNotes = recruiterNotes;
    }

    // Mark as calibrated if any human score or recommendation was provided
    if (
      humanScores ||
      humanRecommendation !== undefined
    ) {
      updateData.humanCalibrated = true;
    }

    const [updated] = await db
      .update(evaluationVersions)
      .set(updateData)
      .where(eq(evaluationVersions.id, latest.id))
      .returning();

    return NextResponse.json({
      latest: {
        id: updated.id,
        sessionId: updated.sessionId,
        model: updated.model,
        aiScores: {
          technicalDepth: updated.aiTechnicalDepth,
          communicationClarity: updated.aiCommunicationClarity,
          problemSolving: updated.aiProblemSolving,
          relevanceToRole: updated.aiRelevanceToRole,
        },
        humanScores: {
          technicalDepth: updated.humanTechnicalDepth,
          communicationClarity: updated.humanCommunicationClarity,
          problemSolving: updated.humanProblemSolving,
          relevanceToRole: updated.humanRelevanceToRole,
        },
        aiRecommendation: updated.aiRecommendation,
        humanRecommendation: updated.humanRecommendation,
        humanCalibrated: updated.humanCalibrated,
        confidence: updated.aiConfidence,
        strengths: updated.strengths,
        weaknesses: updated.weaknesses,
        recruiterNotes: updated.recruiterNotes,
        rawResponse: updated.rawResponse,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    console.error("PATCH /api/evaluations/[sessionId] error:", err);
    return NextResponse.json(
      { error: "Failed to update evaluation" },
      { status: 500 }
    );
  }
}
