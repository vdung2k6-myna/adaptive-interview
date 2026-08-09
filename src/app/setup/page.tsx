import { db } from "@/lib/db";
import { positions, candidates, interviewSessions } from "@/lib/schema";
import { count } from "drizzle-orm";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const positionRows = await db.select().from(positions);
  const candidateRows = await db.select().from(candidates);

  const positionSessionCounts = await db
    .select({ positionId: interviewSessions.positionId, count: count() })
    .from(interviewSessions)
    .groupBy(interviewSessions.positionId);

  const candidateSessionCounts = await db
    .select({ candidateId: interviewSessions.candidateId, count: count() })
    .from(interviewSessions)
    .groupBy(interviewSessions.candidateId);

  const positionUsage = new Map(positionSessionCounts.map((s) => [s.positionId, s.count]));
  const candidateUsage = new Map(candidateSessionCounts.map((s) => [s.candidateId, s.count]));

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <SetupForm
        positions={positionRows}
        candidates={candidateRows}
        positionUsage={positionUsage}
        candidateUsage={candidateUsage}
      />
    </div>
  );
}
