import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interviewSessions, candidates, positions, messages } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sessionRows = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, id));

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = sessionRows[0];

    const candidateRows = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, session.candidateId));

    const positionRows = await db
      .select()
      .from(positions)
      .where(eq(positions.id, session.positionId));

    const messageRows = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(messages.createdAt);

    return NextResponse.json({
      session,
      candidate: candidateRows[0] || null,
      position: positionRows[0] || null,
      messages: messageRows,
    });
  } catch (err) {
    console.error("GET /api/sessions/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
