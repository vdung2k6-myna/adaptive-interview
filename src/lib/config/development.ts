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
    chatTimeoutMs: 120_000, // 120s — kimi-k2.6:cloud needs more time for long context
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
  mcp: {
    enabled: process.env.MCP_ENABLED === "true",
    authToken: process.env.MCP_AUTH_TOKEN || "",
  },
  auth: {
    apiToken: process.env.NEXT_PUBLIC_API_TOKEN || "",
  },
};
