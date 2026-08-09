import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignPositions } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { positionId } = body;
    if (!positionId) {
      return NextResponse.json({ error: "positionId is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(campaignPositions)
      .values({ campaignId: id, positionId: String(positionId) })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns/:id/positions error:", err);
    return NextResponse.json({ error: "Failed to add position to campaign" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const positionId = searchParams.get("positionId");
    if (!positionId) {
      return NextResponse.json({ error: "positionId query param is required" }, { status: 400 });
    }

    await db
      .delete(campaignPositions)
      .where(
        and(
          eq(campaignPositions.campaignId, id),
          eq(campaignPositions.positionId, positionId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/campaigns/:id/positions error:", err);
    return NextResponse.json({ error: "Failed to remove position from campaign" }, { status: 500 });
  }
}
