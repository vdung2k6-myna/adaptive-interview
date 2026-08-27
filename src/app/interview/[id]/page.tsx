"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { apiFetch } from "@/lib/api-client";

const MessageBubble = React.memo(function MessageBubble({ msg }: { msg: Message }) {
  const bubbleClass =
    msg.role === "candidate"
      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
      : "bg-white text-zinc-900 shadow-sm border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:border-zinc-700";

  return (
    <div className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${bubbleClass}`}>
        <p className="text-xs font-medium mb-1 opacity-70">
          {msg.role === "interviewer" ? "Interviewer" : "You"}
        </p>
        {msg.role === "interviewer" ? (
          <MarkdownRenderer content={msg.content} />
        ) : (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        )}
        {msg.role === "interviewer" && msg.content === "" && (
          <div className="flex items-center gap-1 py-1">
            <div className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>
    </div>
  );
});

interface Message {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
  createdAt: string;
}

interface SessionData {
  session: {
    id: string;
    status: string;
    mode: string;
    language: "english" | "vietnamese";
    maxTurns: number;
    currentTurn: number;
  };
  candidate: {
    name: string;
    email: string;
  } | null;
  position: {
    title: string;
    level: string;
  } | null;
  messages: Message[];
}

export default function InterviewPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ref for accumulating streamed content without re-renders
  const streamingContentRef = useRef("");

  async function fetchSession() {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`);
      if (!res.ok) {
        throw new Error("Failed to load session");
      }
      const sessionData: SessionData = await res.json();

      // Redirect voice sessions to voice interview page
      if (sessionData.session.mode === "voice") {
        window.location.href = `/interview/${sessionId}/voice`;
        return;
      }

      setData(sessionData);

      // If no messages yet, trigger first question
      if (sessionData.messages.length === 0 && sessionData.session.status !== "completed") {
        await generateFirstQuestion();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function consumeStream(res: Response, messageId: string) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    streamingContentRef.current = "";
    setStreaming(true);

    // Batch React state updates: only flush every ~50ms instead of on every chunk.
    // Ollama can stream tokens every 10-20ms; without batching, React re-renders
    // 50-100 times per second and re-parses markdown each time.
    const BATCH_MS = 50;
    let lastUpdate = 0;
    let hasPendingUpdate = false;

    const flushUpdate = () => {
      hasPendingUpdate = false;
      lastUpdate = performance.now();
      setData((prev) => {
        if (!prev) return prev;
        const messages = prev.messages.map((msg) => {
          if (msg.id === messageId) {
            return { ...msg, content: streamingContentRef.current };
          }
          return msg;
        });
        return { ...prev, messages };
      });
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamingContentRef.current += chunk;
        hasPendingUpdate = true;

        const now = performance.now();
        if (now - lastUpdate >= BATCH_MS) {
          flushUpdate();
        }
      }

      // Ensure any trailing chunks are flushed
      if (hasPendingUpdate) {
        flushUpdate();
      }
    } catch (err) {
      // Stream error — remove the partial message
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((msg) => msg.id !== messageId),
        };
      });
      throw err;
    } finally {
      setStreaming(false);
      streamingContentRef.current = "";
    }
  }

  async function generateFirstQuestion() {
    setSending(true);
    setError("");
    const messageId = `stream-${Date.now()}`;

    try {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate first question");
      }

      // Add empty interviewer message for streaming
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: messageId,
              role: "interviewer",
              content: "",
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      setSending(false);
      await consumeStream(res, messageId);
      await fetchSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || !data || data.session.status === "completed") return;

    const content = input.trim();
    setInput("");
    setSending(true);
    setError("");

    // Optimistically add candidate message
    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      role: "candidate",
      content,
      createdAt: new Date().toISOString(),
    };
    setData((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimisticMessage] } : prev
    );

    const messageId = `stream-${Date.now()}`;

    try {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, content }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message");
      }

      // Add empty interviewer message for streaming
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: messageId,
              role: "interviewer",
              content: "",
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      setSending(false);
      await consumeStream(res, messageId);
      await fetchSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Remove optimistic candidate and partial interviewer messages
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter(
            (msg) => msg.id !== optimisticMessage.id && msg.id !== messageId
          ),
        };
      });
      setSending(false);
    }
  }

  useEffect(() => {
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <p className="text-zinc-600 dark:text-zinc-400">Loading interview...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <div className="text-center">
          <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              fetchSession();
            }}
            className="min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isComplete = data?.session.status === "completed";

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 sm:text-lg">
                {data?.position?.title || "Interview"}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {data?.candidate?.name} · {data?.position?.level}
              </p>
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {isComplete ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                  Completed
                </span>
              ) : (
                <span>
                  Turn {data?.session.currentTurn ?? 0}/{data?.session.maxTurns ?? 8}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 md:py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {data?.messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {sending && !streaming && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl">
          {isComplete ? (
            <div className="py-2 text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Thank you for completing the interview.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer..."
                disabled={sending}
                className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Send
              </button>
            </form>
          )}

          {error && data && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </footer>
    </div>
  );
}
