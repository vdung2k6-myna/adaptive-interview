import { db } from "@/lib/db";
import { positions } from "@/lib/schema";
import CampaignForm from "./CampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const positionRows = await db.select({ id: positions.id, title: positions.title }).from(positions);

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <CampaignForm positions={positionRows} />
    </div>
  );
}
