import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interviewSessions, candidates, positions, messages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { buildPrompt, PromptMessage } from "@/lib/prompts";
import { generateChatResponseStream } from "@/lib/ollama";
import { storeMessageEmbedding } from "@/lib/embeddings";
import { OllamaError } from "@/lib/errors";

function createStreamingResponse(
  tokenStream: ReadableStream<string>,
  getFullText: () => string,
  onComplete: (fullText: string) => Promise<void>
): Response {
  const encoder = new TextEncoder();

  const clientStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = tokenStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(encoder.encode(value));
        }
        // Stream complete — store full message to DB
        await onComplete(getFullText());
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      tokenStream.cancel();
    },
  });

  return new Response(clientStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  try {
    console.log("[POST /api/messages] Request received");
    const body = await req.json();
    console.log("[POST /api/messages] Body:", body);
    const { sessionId, content } = body as { sessionId?: string; content?: string };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const sessionRows = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId));

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = sessionRows[0];
    console.log("[POST /api/messages] Session found:", session.id, "status:", session.status);

    if (session.status === "completed") {
      const completionText = "This interview has already concluded.";
      const completionStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(completionText);
          controller.close();
        },
      });
      return createStreamingResponse(
        completionStream,
        () => completionText,
        async () => {
          /* no DB write needed for already-completed session */
        }
      );
    }

    const candidateRows = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, session.candidateId));

    const positionRows = await db
      .select()
      .from(positions)
      .where(eq(positions.id, session.positionId));

    const candidate = candidateRows[0];
    const position = positionRows[0];

    if (!candidate || !position) {
      return NextResponse.json(
        { error: "Related candidate or position not found" },
        { status: 404 }
      );
    }

    const existingMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt);

    // First question generation when no messages exist yet
    if (existingMessages.length === 0) {
      const prompt = await buildPrompt(
        {
          id: session.id,
          positionId: session.positionId,
          status: session.status,
          maxTurns: session.maxTurns,
          currentTurn: session.currentTurn,
          position: {
            title: position.title,
            level: position.level,
            jobDescription: position.jobDescription,
            requirements: position.requirements,
          },
          candidate: {
            name: candidate.name,
            skills: candidate.skills,
            experienceYears: candidate.experienceYears,
            cv: candidate.cv,
          },
        },
        []
      );

      console.log("[POST /api/messages] Calling Ollama for first question (stream)...");
      const { stream, getFullText } = generateChatResponseStream({
        messages: prompt,
        temperature: 0.7,
      });

      return createStreamingResponse(stream, getFullText, async (fullText) => {
        console.log("[POST /api/messages] First question stream complete:", fullText.substring(0, 100));
        await db.insert(messages).values({
          sessionId,
          role: "interviewer",
          content: fullText,
        });

        if (session.status === "created") {
          await db
            .update(interviewSessions)
            .set({ status: "in_progress" })
            .where(eq(interviewSessions.id, sessionId));
        }
      });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    // Store candidate answer
    const insertedMessages = await db.insert(messages).values({
      sessionId,
      role: "candidate",
      content: content.trim(),
    }).returning();

    const candidateMessageId = insertedMessages[0].id;

    // Generate and store message embedding (critical path)
    console.log("[POST /api/messages] Generating embedding for candidate message...");
    try {
      const { embedText } = await import("@/lib/ollama");
      const vector = await embedText(content.trim());
      await storeMessageEmbedding(sessionId, candidateMessageId, content.trim(), vector);
      console.log("[POST /api/messages] Embedding stored.");
    } catch (err) {
      console.error("[POST /api/messages] Embedding error:", err);
      if (err instanceof OllamaError) {
        return NextResponse.json(
          { error: `Embedding generation failed: ${err.message}` },
          { status: 503 }
        );
      }
      throw err;
    }

    const newTurn = session.currentTurn + 1;

    if (newTurn >= session.maxTurns) {
      await db
        .update(interviewSessions)
        .set({ status: "completed", currentTurn: newTurn, completedAt: new Date() })
        .where(eq(interviewSessions.id, sessionId));

      const completionText = "Thank you, the interview is complete.";
      const completionStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(completionText);
          controller.close();
        },
      });
      return createStreamingResponse(completionStream, () => completionText, async (fullText) => {
        await db.insert(messages).values({
          sessionId,
          role: "interviewer",
          content: fullText,
        });
      });
    }

    await db
      .update(interviewSessions)
      .set({ currentTurn: newTurn, status: "in_progress" })
      .where(eq(interviewSessions.id, sessionId));

    const promptMessages: PromptMessage[] = existingMessages.map((m) => ({
      role: m.role as "interviewer" | "candidate",
      content: m.content,
    }));
    promptMessages.push({ role: "candidate", content: content.trim() });

    const prompt = await buildPrompt(
      {
        id: session.id,
        positionId: session.positionId,
        status: "in_progress",
        maxTurns: session.maxTurns,
        currentTurn: newTurn,
        position: {
          title: position.title,
          level: position.level,
          jobDescription: position.jobDescription,
          requirements: position.requirements,
        },
        candidate: {
          name: candidate.name,
          skills: candidate.skills,
          experienceYears: candidate.experienceYears,
          cv: candidate.cv,
        },
      },
      promptMessages
    );

    console.log("[POST /api/messages] Calling Ollama for follow-up (stream)...");
    const { stream, getFullText } = generateChatResponseStream({
      messages: prompt,
      temperature: 0.7,
    });

    return createStreamingResponse(stream, getFullText, async (fullText) => {
      console.log("[POST /api/messages] Follow-up stream complete:", fullText.substring(0, 100));
      await db.insert(messages).values({
        sessionId,
        role: "interviewer",
        content: fullText,
      });
    });
  } catch (err) {
    console.error("[POST /api/messages] UNEXPECTED ERROR:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process message" },
      { status: 500 }
    );
  }
}
