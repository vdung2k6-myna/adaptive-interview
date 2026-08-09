import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { positions } from "@/lib/schema";
import { embedText } from "@/lib/ollama";
import { storeRequirementEmbedding } from "@/lib/embeddings";
import { OllamaError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, level, requirements, jobDescription } = body;

    if (!title || !level || !Array.isArray(requirements) || requirements.length === 0) {
      return NextResponse.json(
        { error: "title, level, and at least one requirement are required" },
        { status: 400 }
      );
    }

    const cleanedRequirements = requirements
      .map((r: unknown) => String(r).trim())
      .filter(Boolean);

    const position = await db
      .insert(positions)
      .values({
        title: String(title).trim(),
        level: String(level).trim(),
        jobDescription: jobDescription ? String(jobDescription).trim() : null,
        requirements: cleanedRequirements,
      })
      .returning();

    const positionId = position[0].id;

    // Generate and store embeddings for each requirement
    for (const req of cleanedRequirements) {
      const vector = await embedText(req);
      await storeRequirementEmbedding(positionId, req, vector);
    }

    return NextResponse.json(position[0], { status: 201 });
  } catch (err) {
    console.error("POST /api/positions error:", err);

    if (err instanceof OllamaError) {
      return NextResponse.json(
        { error: `Embedding generation failed: ${err.message}` },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create position" },
      { status: 500 }
    );
  }
}
