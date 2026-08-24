/**
 * Lightweight frontend type definitions.
 *
 * These replace the Drizzle schema types that were previously imported
 * from `@/lib/schema`. They only include fields the frontend actually
 * renders, keeping the monolith decoupled from the database layer.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Candidates
// ─────────────────────────────────────────────────────────────────────────────

export interface Candidate {
  id: string;
  name: string;
  email: string;
  skills: string[];
  experienceYears: number | null;
  cv: string | null;
  createdAt: string;
  sessionCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Positions
// ─────────────────────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  title: string;
  level: string;
  jobDescription: string | null;
  requirements: string[];
  createdAt: string;
  sessionCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns
// ─────────────────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  tags: string[];
  positionCount?: number;
  sessionCount?: number;
}

export interface CampaignDetail extends Campaign {
  positions: Position[];
  metrics: {
    totalSessions: number;
    completionRate: number;
    avgAiScore: number | null;
    avgHumanScore: number | null;
  };
  recommendations: Record<string, number>;
  topCandidates: Array<{
    sessionId: string;
    candidateName: string;
    aiAvg: number | null;
    humanAvg: number | null;
    recommendation: string | null;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interview Sessions
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewSession {
  id: string;
  positionId: string;
  candidateId: string;
  status: string;
  mode: string;
  currentTurn: number;
  maxTurns: number;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluations
// ─────────────────────────────────────────────────────────────────────────────

export interface EvaluationVersion {
  id: string;
  sessionId: string;
  aiTechnicalDepth: number | null;
  aiCommunicationClarity: number | null;
  aiProblemSolving: number | null;
  aiRelevanceToRole: number | null;
  aiRecommendation: string | null;
  humanTechnicalDepth: number | null;
  humanCommunicationClarity: number | null;
  humanProblemSolving: number | null;
  humanRelevanceToRole: number | null;
  humanRecommendation: string | null;
  strengths: string[];
  weaknesses: string[];
  recruiterNotes: string | null;
  humanCalibrated: boolean;
  createdAt: string;
}
