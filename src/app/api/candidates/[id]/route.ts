import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { candidates, interviewSessions } from "@/lib/schema";
import { eq, count } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await db.select().from(candidates).where(eq(candidates.id, id));
    if (rows.length === 0) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("GET /api/candidates/:id error:", err);
    return NextResponse.json({ error: "Failed to fetch candidate" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check if candidate exists
    const existing = await db.select().from(candidates).where(eq(candidates.id, id));
    if (existing.length === 0) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Check if candidate is referenced by any session
    const sessionCount = await db
      .select({ count: count() })
      .from(interviewSessions)
      .where(eq(interviewSessions.candidateId, id));
    if (sessionCount[0].count > 0) {
      return NextResponse.json(
        { error: "Cannot edit candidate that is referenced by existing sessions" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const { name, email, skills, experienceYears, cv } = body;

    const updateValues: Partial<typeof candidates.$inferInsert> = {};
    if (name !== undefined) updateValues.name = String(name).trim();
    if (email !== undefined) updateValues.email = String(email).trim();
    if (skills !== undefined && Array.isArray(skills)) {
      updateValues.skills = skills.map((s: unknown) => String(s).trim()).filter(Boolean);
    }
    if (experienceYears !== undefined) {
      updateValues.experienceYears = experienceYears ? Number(experienceYears) : null;
    }
    if (cv !== undefined) {
      updateValues.cv = cv ? String(cv).trim() : null;
    }

    const [updated] = await db
      .update(candidates)
      .set(updateValues)
      .where(eq(candidates.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/candidates/:id error:", err);
    return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check if candidate exists
    const existing = await db.select().from(candidates).where(eq(candidates.id, id));
    if (existing.length === 0) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Check if candidate is referenced by any session
    const sessionCount = await db
      .select({ count: count() })
      .from(interviewSessions)
      .where(eq(interviewSessions.candidateId, id));
    if (sessionCount[0].count > 0) {
      return NextResponse.json(
        { error: "Cannot delete candidate that is referenced by existing sessions" },
        { status: 409 }
      );
    }

    await db.delete(candidates).where(eq(candidates.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/candidates/:id error:", err);
    return NextResponse.json({ error: "Failed to delete candidate" }, { status: 500 });
  }
}
