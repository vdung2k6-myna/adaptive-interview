import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluationVersions } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;

    const rows = await db
      .select()
      .from(evaluationVersions)
      .where(eq(evaluationVersions.id, versionId));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const v = rows[0];

    return NextResponse.json({
      id: v.id,
      sessionId: v.sessionId,
      model: v.model,
      aiScores: {
        technicalDepth: v.aiTechnicalDepth,
        communicationClarity: v.aiCommunicationClarity,
        problemSolving: v.aiProblemSolving,
        relevanceToRole: v.aiRelevanceToRole,
      },
      humanScores: {
        technicalDepth: v.humanTechnicalDepth,
        communicationClarity: v.humanCommunicationClarity,
        problemSolving: v.humanProblemSolving,
        relevanceToRole: v.humanRelevanceToRole,
      },
      aiRecommendation: v.aiRecommendation,
      humanRecommendation: v.humanRecommendation,
      humanCalibrated: v.humanCalibrated,
      confidence: v.aiConfidence,
      strengths: v.strengths,
      weaknesses: v.weaknesses,
      recruiterNotes: v.recruiterNotes,
      rawResponse: v.rawResponse,
      createdAt: v.createdAt,
    });
  } catch (err) {
    console.error("GET /api/evaluations/versions/[versionId] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch evaluation version" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;

    // Find the version to delete
    const versionRows = await db
      .select()
      .from(evaluationVersions)
      .where(eq(evaluationVersions.id, versionId));

    if (versionRows.length === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const version = versionRows[0];
    const sessionId = version.sessionId;

    // Check if this is the latest version for the session
    const latestRows = await db
      .select()
      .from(evaluationVersions)
      .where(eq(evaluationVersions.sessionId, sessionId))
      .orderBy(desc(evaluationVersions.createdAt))
      .limit(1);

    const latest = latestRows[0];
    if (latest.id === versionId) {
      return NextResponse.json(
        { error: "Cannot delete the latest evaluation version" },
        { status: 400 }
      );
    }

    // Delete the version
    await db
      .delete(evaluationVersions)
      .where(eq(evaluationVersions.id, versionId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/evaluations/versions/[versionId] error:", err);
    return NextResponse.json(
      { error: "Failed to delete evaluation version" },
      { status: 500 }
    );
  }
}
