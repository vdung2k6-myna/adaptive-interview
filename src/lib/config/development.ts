import type { AppConfig } from "./index";

export const developmentConfig: AppConfig = {
  env: "development",
  database: {
    poolSize: 5,
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    chatModel: process.env.OLLAMA_MODEL || "llama3.1",
    embedModel: process.env.OLLAMA_EMBED_MODEL || "mxbai-embed-large",
    chatTimeoutMs: 60_000, // 60s — generous for local dev with model loading
    embedTimeoutMs: 15_000, // 15s
    retries: 1,
  },
  evaluation: {
    temperature: 0.3,
    maxAttempts: 3,
  },
  features: {
    enableStreaming: true,
    enableEvaluations: true,
    enableEmbeddings: true,
  },
};
