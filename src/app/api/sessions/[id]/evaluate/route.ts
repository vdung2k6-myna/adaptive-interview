import { NextRequest, NextResponse } from "next/server";
import { generateEvaluation } from "@/lib/evaluation";
import { OllamaError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { model } = body as { model?: string };
    const evaluation = await generateEvaluation(id, model);
    return NextResponse.json(evaluation);
  } catch (err) {
    console.error("POST /api/sessions/[id]/evaluate error:", err);

    if (err instanceof Error) {
      if (err.message === "Interview is not completed") {
        return NextResponse.json(
          { error: "Interview must be completed before evaluation" },
          { status: 400 }
        );
      }
      if (err.message === "Session not found") {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      if (err.message === "No messages found for session") {
        return NextResponse.json(
          { error: "No interview transcript found" },
          { status: 400 }
        );
      }
    }

    if (err instanceof OllamaError) {
      return NextResponse.json(
        { error: `Ollama error: ${err.message}` },
        { status: err.statusCode || 503 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate evaluation" },
      { status: 500 }
    );
  }
}
