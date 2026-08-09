import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { positions, interviewSessions, embeddings } from "@/lib/schema";
import { eq, count } from "drizzle-orm";
import { embedText } from "@/lib/ollama";
import { storeRequirementEmbedding } from "@/lib/embeddings";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await db.select().from(positions).where(eq(positions.id, id));
    if (rows.length === 0) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("GET /api/positions/:id error:", err);
    return NextResponse.json({ error: "Failed to fetch position" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check if position exists
    const existing = await db.select().from(positions).where(eq(positions.id, id));
    if (existing.length === 0) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    // Check if position is referenced by any session
    const sessionCount = await db
      .select({ count: count() })
      .from(interviewSessions)
      .where(eq(interviewSessions.positionId, id));
    if (sessionCount[0].count > 0) {
      return NextResponse.json(
        { error: "Cannot edit position that is referenced by existing sessions" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const { title, level, requirements, jobDescription } = body;

    const updateValues: Partial<typeof positions.$inferInsert> = {};
    if (title !== undefined) updateValues.title = String(title).trim();
    if (level !== undefined) updateValues.level = String(level).trim();
    if (jobDescription !== undefined) updateValues.jobDescription = jobDescription ? String(jobDescription).trim() : null;

    let requirementsChanged = false;
    if (requirements !== undefined && Array.isArray(requirements)) {
      const cleaned = requirements.map((r: unknown) => String(r).trim()).filter(Boolean);
      updateValues.requirements = cleaned;
      requirementsChanged = true;
    }

    // Update position
    const [updated] = await db
      .update(positions)
      .set(updateValues)
      .where(eq(positions.id, id))
      .returning();

    // If requirements changed, regenerate embeddings
    if (requirementsChanged && updateValues.requirements) {
      // Delete old requirement embeddings for this position
      await db.delete(embeddings).where(
        eq(embeddings.sourceId, id)
        // sourceType is 'requirement' — we can be more precise if needed,
        // but sourceId is the position id for requirements
      );

      // Generate and store new embeddings
      for (const req of updateValues.requirements) {
        const vector = await embedText(req);
        await storeRequirementEmbedding(id, req, vector);
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/positions/:id error:", err);
    return NextResponse.json({ error: "Failed to update position" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check if position exists
    const existing = await db.select().from(positions).where(eq(positions.id, id));
    if (existing.length === 0) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    // Check if position is referenced by any session
    const sessionCount = await db
      .select({ count: count() })
      .from(interviewSessions)
      .where(eq(interviewSessions.positionId, id));
    if (sessionCount[0].count > 0) {
      return NextResponse.json(
        { error: "Cannot delete position that is referenced by existing sessions" },
        { status: 409 }
      );
    }

    // Delete requirement embeddings for this position
    await db.delete(embeddings).where(eq(embeddings.sourceId, id));

    // Delete position
    await db.delete(positions).where(eq(positions.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/positions/:id error:", err);
    return NextResponse.json({ error: "Failed to delete position" }, { status: 500 });
  }
}
