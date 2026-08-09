import { db } from "@/lib/db";
import { candidates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import CandidateForm from "../../new/CandidateForm";

export const dynamic = "force-dynamic";

export default async function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(candidates).where(eq(candidates.id, id));

  if (rows.length === 0) {
    notFound();
  }

  const candidate = rows[0];

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <CandidateForm
        initialData={{
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          skills: candidate.skills,
          experienceYears: candidate.experienceYears,
          cv: candidate.cv,
        }}
      />
    </div>
  );
}
