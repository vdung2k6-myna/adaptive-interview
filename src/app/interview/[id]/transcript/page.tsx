"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ScoreInput } from "@/components/ScoreInput";
import { ModelBadge } from "@/components/ModelBadge";
import { VersionHistory } from "@/components/VersionHistory";

interface Message {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
  createdAt: string;
}

interface AiScores {
  technicalDepth: number | null;
  communicationClarity: number | null;
  problemSolving: number | null;
  relevanceToRole: number | null;
}

interface HumanScores {
  technicalDepth: number | null;
  communicationClarity: number | null;
  problemSolving: number | null;
  relevanceToRole: number | null;
}

interface LatestEvaluation {
  id: string;
  sessionId: string;
  model: string;
  aiScores: AiScores;
  humanScores: HumanScores;
  aiRecommendation: string | null;
  humanRecommendation: string | null;
  humanCalibrated: boolean;
  confidence: number | null;
  strengths: string[];
  weaknesses: string[];
  recruiterNotes: string | null;
  rawResponse: string;
  createdAt: string;
}

interface EvalVersion {
  id: string;
  model: string;
  humanCalibrated: boolean;
  createdAt: string;
}

interface SessionData {
  session: {
    id: string;
    status: string;
    maxTurns: number;
    currentTurn: number;
    createdAt: string;
    completedAt: string | null;
  };
  candidate: {
    name: string;
    email: string;
    skills: string[];
    experienceYears: number | null;
  } | null;
  position: {
    title: string;
    level: string;
    requirements: string[];
  } | null;
  messages: Message[];
}

const AVAILABLE_MODELS = [
  { value: "", label: "Default (server config)" },
  { value: "llama3.1", label: "Llama 3.1" },
  { value: "llama3.2", label: "Llama 3.2" },
  { value: "qwen2.5", label: "Qwen 2.5" },
  { value: "mistral", label: "Mistral" },
  { value: "gemma2", label: "Gemma 2" },
];

const RECOMMENDATION_OPTIONS = [
  { value: "", label: "—" },
  { value: "strong_yes", label: "Strong Yes" },
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
  { value: "strong_no", label: "Strong No" },
];

export default function TranscriptPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [latest, setLatest] = useState<LatestEvaluation | null>(null);
  const [versions, setVersions] = useState<EvalVersion[]>([]);
  const [viewingVersion, setViewingVersion] = useState<LatestEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState("");
  const [savingCalibration, setSavingCalibration] = useState(false);

  const [humanScores, setHumanScores] = useState<HumanScores>({
    technicalDepth: null,
    communicationClarity: null,
    problemSolving: null,
    relevanceToRole: null,
  });
  const [humanRecommendation, setHumanRecommendation] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const activeEvaluation = viewingVersion || latest;
  const isViewingHistory = !!viewingVersion;

  useEffect(() => {
    fetchSession();
    fetchEvaluation();
  }, [sessionId]);

  async function fetchSession() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load session");
      const data: SessionData = await res.json();
      setSessionData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvaluation() {
    try {
      const res = await fetch(`/api/evaluations/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setLatest(data.latest);
        setVersions(data.versions);
        if (data.latest) {
          setHumanScores(data.latest.humanScores);
          setHumanRecommendation(data.latest.humanRecommendation);
          setNotes(data.latest.recruiterNotes || "");
        }
      }
    } catch {
      // Evaluation may not exist yet — that's fine
    }
  }

  async function fetchVersion(versionId: string) {
    try {
      const res = await fetch(`/api/evaluations/versions/${versionId}`);
      if (!res.ok) throw new Error("Failed to load version");
      const data: LatestEvaluation = await res.json();
      setViewingVersion(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load version");
    }
  }

  async function generateEvaluation() {
    setEvalLoading(true);
    setEvalError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate evaluation");
      }
      // Refetch to get proper {latest, versions} shape
      await fetchEvaluation();
      setViewingVersion(null);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEvalLoading(false);
    }
  }

  async function saveCalibration() {
    if (!latest) return;
    setSavingCalibration(true);
    try {
      const res = await fetch(`/api/evaluations/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          humanScores: humanScores,
          humanRecommendation: humanRecommendation || undefined,
          recruiterNotes: notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to save calibration");
      const data = await res.json();
      setLatest(data.latest);
      setVersions((prev) =>
        prev.map((v) =>
          v.id === data.latest.id ? { ...v, humanCalibrated: true } : v
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save calibration");
    } finally {
      setSavingCalibration(false);
    }
  }

  async function deleteVersion(versionId: string) {
    if (!confirm("Delete this evaluation version?")) return;
    try {
      const res = await fetch(`/api/evaluations/versions/${versionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete version");
      }
      if (viewingVersion?.id === versionId) {
        setViewingVersion(null);
      }
      await fetchEvaluation();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete version");
    }
  }

  function handleVersionSelect(versionId: string) {
    if (latest && versionId === latest.id) {
      setViewingVersion(null);
    } else {
      fetchVersion(versionId);
    }
  }

  function StarRating({ score, label }: { score: number | null; label: string }) {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={`text-lg ${
                score !== null && n <= score
                  ? "text-yellow-500"
                  : "text-zinc-300 dark:text-zinc-600"
              }`}
            >
              ★
            </span>
          ))}
          <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">
            {score ?? "—"}/5
          </span>
        </div>
      </div>
    );
  }

  function RecommendationBadge({ rec }: { rec: string | null }) {
    if (!rec) return <span className="text-zinc-400">—</span>;
    const colors: Record<string, string> = {
      strong_yes: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      yes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      maybe: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      no: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      strong_no: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return (
      <span className={`rounded-lg px-3 py-1 text-sm font-medium ${colors[rec] || colors.maybe}`}>
        {rec.replace("_", " ").toUpperCase()}
      </span>
    );
  }

  async function copyInterviewLink() {
    const url = `${window.location.origin}/interview/${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function hasCalibrationChanges(): boolean {
    if (!latest) return false;
    return (
      humanScores.technicalDepth !== latest.humanScores.technicalDepth ||
      humanScores.communicationClarity !== latest.humanScores.communicationClarity ||
      humanScores.problemSolving !== latest.humanScores.problemSolving ||
      humanScores.relevanceToRole !== latest.humanScores.relevanceToRole ||
      humanRecommendation !== latest.humanRecommendation ||
      notes !== (latest.recruiterNotes || "")
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-600 dark:text-zinc-400">Loading transcript...</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-red-600 dark:text-red-400">Session not found.</p>
      </div>
    );
  }

  const { session, candidate, position, messages } = sessionData;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {candidate?.name || "Unknown Candidate"} — {position?.title || "Interview"}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {position?.level} · {session.status === "completed" ? "Completed" : "In Progress"} ·{" "}
              {session.currentTurn}/{session.maxTurns} turns
              {session.completedAt && ` · ${new Date(session.completedAt).toLocaleDateString()}`}
            </p>
          </div>
          <button
            onClick={copyInterviewLink}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {copied ? "✓ Link Copied" : "Copy Interview Link"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transcript */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">
                Interview Transcript
              </h2>
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="border-l-2 border-zinc-200 dark:border-zinc-700 pl-4">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      {msg.role === "interviewer" ? "🤖 Interviewer" : "👤 Candidate"}
                    </p>
                    {msg.role === "interviewer" ? (
                      <div className="text-sm text-zinc-800 dark:text-zinc-200">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Evaluation Panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                  {isViewingHistory ? "Evaluation (Historical)" : "AI Evaluation"}
                </h2>
                {activeEvaluation && <ModelBadge model={activeEvaluation.model} />}
              </div>

              {isViewingHistory && (
                <div className="mb-3 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Viewing version from{" "}
                    {new Date(viewingVersion!.createdAt).toLocaleString()}
                  </p>
                  <button
                    onClick={() => setViewingVersion(null)}
                    className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline mt-1"
                  >
                    Back to latest
                  </button>
                </div>
              )}

              {!activeEvaluation && session.status === "completed" && (
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                    No evaluation yet.
                  </p>
                  <div className="space-y-2">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      {AVAILABLE_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={generateEvaluation}
                      disabled={evalLoading}
                      className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      {evalLoading ? "Generating..." : "Generate Evaluation"}
                    </button>
                  </div>
                  {evalError && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{evalError}</p>
                  )}
                </div>
              )}

              {session.status !== "completed" && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Evaluation available after interview is completed.
                </p>
              )}

              {activeEvaluation && (
                <div className="space-y-3">
                  {/* AI Scores */}
                  <StarRating
                    score={activeEvaluation.aiScores.technicalDepth}
                    label="Technical Depth"
                  />
                  <StarRating
                    score={activeEvaluation.aiScores.communicationClarity}
                    label="Communication"
                  />
                  <StarRating
                    score={activeEvaluation.aiScores.problemSolving}
                    label="Problem Solving"
                  />
                  <StarRating
                    score={activeEvaluation.aiScores.relevanceToRole}
                    label="Relevance"
                  />

                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">AI Recommendation</p>
                    <RecommendationBadge rec={activeEvaluation.aiRecommendation} />
                  </div>

                  {activeEvaluation.confidence !== null && (
                    <div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Confidence:{" "}
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {activeEvaluation.confidence}%
                        </span>
                      </p>
                    </div>
                  )}

                  {activeEvaluation.strengths.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Strengths
                      </p>
                      <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-0.5">
                        {activeEvaluation.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeEvaluation.weaknesses.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Weaknesses
                      </p>
                      <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-0.5">
                        {activeEvaluation.weaknesses.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!activeEvaluation.aiScores.technicalDepth && activeEvaluation.rawResponse && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-700 dark:text-red-300 mb-1">
                        Evaluation failed to parse.
                      </p>
                      <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {activeEvaluation.rawResponse}
                      </pre>
                    </div>
                  )}

                  {/* Human Override Section */}
                  {!isViewingHistory && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Human Override
                        </p>
                        {latest?.humanCalibrated && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Calibrated
                          </span>
                        )}
                      </div>

                      <ScoreInput
                        label="Technical Depth"
                        value={humanScores.technicalDepth}
                        onChange={(v) =>
                          setHumanScores((prev) => ({ ...prev, technicalDepth: v }))
                        }
                      />
                      <ScoreInput
                        label="Communication"
                        value={humanScores.communicationClarity}
                        onChange={(v) =>
                          setHumanScores((prev) => ({ ...prev, communicationClarity: v }))
                        }
                      />
                      <ScoreInput
                        label="Problem Solving"
                        value={humanScores.problemSolving}
                        onChange={(v) =>
                          setHumanScores((prev) => ({ ...prev, problemSolving: v }))
                        }
                      />
                      <ScoreInput
                        label="Relevance"
                        value={humanScores.relevanceToRole}
                        onChange={(v) =>
                          setHumanScores((prev) => ({ ...prev, relevanceToRole: v }))
                        }
                      />

                      <div className="mt-2">
                        <label className="text-sm text-zinc-600 dark:text-zinc-400 block mb-1">
                          Your Recommendation
                        </label>
                        <select
                          value={humanRecommendation || ""}
                          onChange={(e) =>
                            setHumanRecommendation(e.target.value || null)
                          }
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                        >
                          {RECOMMENDATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Recruiter Notes */}
                  {!isViewingHistory && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Recruiter Notes
                      </p>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add your own observations..."
                        rows={3}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                      <button
                        onClick={saveCalibration}
                        disabled={savingCalibration || !hasCalibrationChanges()}
                        className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        {savingCalibration ? "Saving..." : "Save Calibration & Notes"}
                      </button>
                    </div>
                  )}

                  {/* Re-evaluate */}
                  {!isViewingHistory && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Re-evaluate
                      </p>
                      <div className="space-y-2">
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                        >
                          {AVAILABLE_MODELS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={generateEvaluation}
                          disabled={evalLoading}
                          className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {evalLoading ? "Generating..." : "Run New Evaluation"}
                        </button>
                      </div>
                      {evalError && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{evalError}</p>
                      )}
                    </div>
                  )}

                  {/* Version History */}
                  <VersionHistory
                    versions={versions}
                    currentVersionId={activeEvaluation?.id}
                    onSelect={handleVersionSelect}
                    onDelete={deleteVersion}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
