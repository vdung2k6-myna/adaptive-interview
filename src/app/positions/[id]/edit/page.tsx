import { db } from "@/lib/db";
import { positions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import PositionForm from "../../new/PositionForm";

export const dynamic = "force-dynamic";

export default async function EditPositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(positions).where(eq(positions.id, id));

  if (rows.length === 0) {
    notFound();
  }

  const position = rows[0];

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <PositionForm
        initialData={{
          id: position.id,
          title: position.title,
          level: position.level,
          jobDescription: position.jobDescription,
          requirements: position.requirements,
        }}
      />
    </div>
  );
}
