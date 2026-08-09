import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignPositions, interviewSessions } from "@/lib/schema";
import { count } from "drizzle-orm";

export async function GET() {
  try {
    const campaignRows = await db.select().from(campaigns).orderBy(campaigns.createdAt);

    // Count sessions per campaign (via positions)
    const positionRows = await db
      .select({
        campaignId: campaignPositions.campaignId,
        positionId: campaignPositions.positionId,
      })
      .from(campaignPositions);

    const positionIdsByCampaign = new Map<string, string[]>();
    for (const row of positionRows) {
      const list = positionIdsByCampaign.get(row.campaignId) || [];
      list.push(row.positionId);
      positionIdsByCampaign.set(row.campaignId, list);
    }

    // Count sessions per position
    const sessionCounts = await db
      .select({
        positionId: interviewSessions.positionId,
        count: count(),
      })
      .from(interviewSessions)
      .groupBy(interviewSessions.positionId);

    const sessionCountMap = new Map(sessionCounts.map((s) => [s.positionId, s.count]));

    const results = campaignRows.map((c) => {
      const posIds = positionIdsByCampaign.get(c.id) || [];
      const totalSessions = posIds.reduce((sum, pid) => sum + (sessionCountMap.get(pid) || 0), 0);
      return {
        ...c,
        positionCount: posIds.length,
        sessionCount: totalSessions,
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/campaigns error:", err);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, startDate, endDate, tags, status } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        tags: Array.isArray(tags) ? tags.map((t: unknown) => String(t).trim()).filter(Boolean) : [],
        status: status || "draft",
      })
      .returning();

    const positionIds = body.positionIds;
    if (Array.isArray(positionIds) && positionIds.length > 0) {
      await db.insert(campaignPositions).values(
        positionIds.map((pid: unknown) => ({
          campaignId: campaign.id,
          positionId: String(pid),
        }))
      );
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns error:", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
