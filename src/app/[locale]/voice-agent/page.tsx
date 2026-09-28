"use client";

import React, { useState, useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import AudioRecorder from "@/components/AudioRecorder";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { SentenceAudioQueue } from "@/lib/audio/sentence-queue";
import { apiFetch } from "@/lib/api-client";
import {
  createVoicePrefetch,
  shouldPrefetch,
  type VoicePrefetchController,
} from "@/lib/voice-prefetch";
import {
  DEFAULT_CATALOG_TIMEOUT_MS,
  fetchPersonaCatalog,
  resolveAnswerMode,
  resolvePersona,
  type AnswerMode,
} from "@/lib/persona-catalog";
import { PERSONAS, getPersonaById, type Persona } from "./personas";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

/**
 * How long the page waits for the persona catalog before offering its built-in
 * list (design.md D10). Config-driven rather than fixed so a deployment that
 * knows its own API is slow can say so; the default is the module's, and short,
 * because the fallback is the same set of personas the catalog seeds.
 */
const CATALOG_TIMEOUT_MS =
  Number(process.env.NEXT_PUBLIC_PERSONA_CATALOG_TIMEOUT_MS) || DEFAULT_CATALOG_TIMEOUT_MS;

interface AgentMessage {
  id: string;
  role: "agent" | "user";
  content: string;
  createdAt: string;
}

interface AgentConfig {
  language: "english" | "vietnamese";
  engine: "kokoro" | "piper" | "supertonic";
  personaId: string;
  systemPrompt: string;
  enabledTopics: string[];
  /**
   * The mode the session's persona produces its replies in, as the catalog
   * declared it. Carried here rather than looked up per turn because it is a
   * property of the session that was started: the persona select can be changed
   * without restarting, and a turn belongs to the session, not to the selection.
   */
  answerMode: AnswerMode;
}

/**
 * The part of the configuration this browser remembers. The per-topic selection
 * belongs here because it is a choice a persona's own `knowledgeTopics` cannot
 * stand in for: coming back to find an unchecked topic checked again is losing
 * the choice, not restoring it.
 */
interface StoredVoiceAgentConfig {
  personaId?: string;
  language?: "english" | "vietnamese";
  engine?: "kokoro" | "piper" | "supertonic";
  enabledTopics?: string[];
}

const CONFIG_STORAGE_KEY = "voiceAgentConfig";

/**
 * What this browser remembers, or an empty object on any failure — a page that
 * cannot read its own memory must still render.
 */
function readStoredConfig(): StoredVoiceAgentConfig {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StoredVoiceAgentConfig) : {};
  } catch {
    return {};
  }
}

/**
 * Remembers a choice as it is made, merged into what is already stored, so
 * returning to the page restores what was last chosen rather than only what was
 * last started — `startConversation` used to be the sole writer, which is why
 * picking a persona and leaving the page lost the choice.
 */
function persistDraft(patch: StoredVoiceAgentConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify({ ...readStoredConfig(), ...patch })
    );
  } catch {
    // Unremembered is an acceptable outcome (private mode, quota) and must not
    // be a reason the page fails.
  }
}

/**
 * The persona whose id is exactly this, in the list the page is showing, falling
 * back to the built-in list for an id the catalog does not carry. `getPersonaById`
 * answers with the first persona when it does not recognise an id, so it cannot
 * decide whether an id is real — and a remembered id that is no longer a persona
 * has to fall back to the default rather than be adopted as a selection with no
 * option behind it.
 */
function findPersonaIn(list: readonly Persona[], id: string): Persona | undefined {
  return resolvePersona(id, list, PERSONAS);
}

interface SentenceEvent {
  index: number;
  text: string;
  audioData: string | null;
}

interface DoneEvent {
  messageId: string;
  fullText: string;
}

interface UserEvent {
  text: string;
  messageId: string;
}

/** A turn the server ended without an answer, and what to say about it. `code` is
 * the reason, translated by the client; `message` is the server's own wording,
 * used for a code this build does not know. */
interface NoticeEvent {
  code?: string;
  message?: string;
}

export default function VoiceAgentPage() {
  const t = useTranslations("voiceAgent");
  const searchParams = useSearchParams();
  const personaIdDefault = "friendly-partner";
  // Configuration state
  const [language, setLanguage] = useState<"english" | "vietnamese">("english");
  const [engine, setEngine] = useState<"kokoro" | "piper" | "supertonic">("supertonic");
  const [personaId, setPersonaId] = useState<string>(personaIdDefault);
  /**
   * The personas the page offers: the catalog once it has been read, and the
   * built-in list until then — and for good, when the catalog cannot be read.
   */
  const [personas, setPersonas] = useState<Persona[]>(PERSONAS);
  const [systemPrompt, setSystemPrompt] = useState<string>(
    getPersonaById(personaIdDefault)?.defaultPrompt || ""
  );
  const [enabledTopics, setEnabledTopics] = useState<string[]>([]);
  const [autoStartFailed, setAutoStartFailed] = useState(false);
  const [isResolvingConfig, setIsResolvingConfig] = useState(true);

  // Chat state
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // A remark about a turn that ended without an answer, as opposed to `error`,
  // which is a turn that ended because something broke. Kept apart so the two can
  // be styled, and read, differently.
  const [notice, setNotice] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  // Whether playback is wanted at all, independent of how the next message is
  // sent. Session-only on purpose: a mute remembered across a visit would silence
  // a conversation the returning user has no memory of muting.
  const [muted, setMuted] = useState(false);
  const [textInput, setTextInput] = useState("");

  // Streaming state
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [streamItems, setStreamItems] = useState<
    { index: number; text: string; audioUrl?: string | null }[]
  >([]);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sentenceQueueRef = useRef<SentenceAudioQueue | null>(null);
  const pendingChunksRef = useRef<
    Map<number, { audio: AudioBuffer | null; text: string }>
  >(new Map());
  const nextExpectedIndexRef = useRef(0);
  const seenSentenceIndicesRef = useRef(new Set<number>());

  // Per-turn guards
  const turnGenerationRef = useRef(0);
  const turnAbortRef = useRef<AbortController | null>(null);
  const [queueIsPlaying, setQueueIsPlaying] = useState(false);
  /**
   * Whether the turn's sentences should be played, read *by the reading loop*
   * rather than taken at fetch time: the loop is a closure built in the render
   * that started the turn, so state read inside it is the value from that render.
   * Switching mode or muting mid-answer is exactly the case this has to catch, and
   * only a ref carries a change made after the closure was built.
   */
  const wantsAudioRef = useRef(true);

  // Replay state
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const speakGenerationRef = useRef(0);
  const speakAbortRef = useRef<AbortController | null>(null);
  const speakPendingChunksRef = useRef<
    Map<number, { audio: AudioBuffer | null; text: string }>
  >(new Map());
  const speakNextExpectedIndexRef = useRef(0);
  const speakSeenSentenceIndicesRef = useRef(new Set<number>());
  const speakStreamDoneRef = useRef(false);

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasAttemptedAutoStartRef = useRef(false);

  // Speculative knowledge retrieval for text turns (design.md D6). Created on
  // first use rather than during render, so nothing is set up for a session that
  // never types.
  const prefetchRef = useRef<VoicePrefetchController | null>(null);
  function getPrefetch(): VoicePrefetchController {
    if (!prefetchRef.current) {
      prefetchRef.current = createVoicePrefetch({ fetch: apiFetch, baseUrl: BACKEND_URL });
    }
    return prefetchRef.current;
  }

  /**
   * Note the current input state. Every path that changes what the user might
   * submit goes through here, so the prefetch policy lives in one place.
   */
  function noteDraft(mode: "voice" | "text", text: string) {
    if (config && shouldPrefetch({ mode, text, topics: config.enabledTopics })) {
      getPrefetch().schedule(text, config.enabledTopics);
    } else {
      getPrefetch().cancel();
    }
  }

  // Leaving the page must not leave the agent talking to an empty room. React
  // drops these refs, but nothing they hold stops on its own: a scheduled Web
  // Audio source outlives the component, and the SSE reader is an ordinary
  // closure that keeps queueing sentences until something aborts it. The abort
  // is also what lets the server see the connection close, which is what stops
  // it generating the rest of the turn.
  useEffect(() => {
    return () => {
      prefetchRef.current?.cancel();
      cleanupStreamState();
      stopSpeaking();
      // Suspended, not closed: a closed context needs a fresh user gesture to
      // resume on mobile Safari, which the next visit's auto-start does not give.
      void audioCtxRef.current?.suspend().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamItems.length]);

  // The topic selection is set where it is decided rather than by an effect on
  // `personaId`: the config effect below restores a remembered selection on
  // mount, and the persona select resets it to the new persona's own topics.

  /**
   * The persona an id names, in what the page is offering, the built-in list
   * answering for an id the catalog does not carry.
   */
  const findPersona = (id: string): Persona | undefined => findPersonaIn(personas, id);

  /**
   * The same lookup for display: an id the page cannot resolve at all still has
   * to render something, so it renders the default persona rather than nothing.
   */
  const personaFor = (id: string): Persona => findPersona(id) ?? PERSONAS[0];

  // Resolve config from URL params + localStorage + defaults.
  //
  // The catalog is read before anything is resolved, because both a deep link and
  // a remembered id are validated against the personas the page is about to
  // offer — and the read is bounded by `CATALOG_TIMEOUT_MS`, so an API that never
  // answers costs the wait rather than the page. `isResolvingConfig` stays true
  // until it settles, which is what keeps the auto-start from sending a first
  // turn as a persona the page has not finished choosing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let abandoned = false;

    void (async () => {
      const loaded = await fetchPersonaCatalog({
        fetch: apiFetch,
        baseUrl: BACKEND_URL,
        timeoutMs: CATALOG_TIMEOUT_MS,
      });
      // A load that settles after the page has gone must not set state on it.
      if (abandoned) return;

      // The catalog is authoritative when it answers; the built-in list answers
      // when it does not, which is what keeps a session startable either way
      // (design.md D10).
      const offered: Persona[] = loaded ?? PERSONAS;

      const urlPersona = searchParams.get("persona");
      const urlLang = searchParams.get("lang");
      const urlEngine = searchParams.get("engine");

      let resolvedPersona = personaIdDefault;
      let resolvedLang: "english" | "vietnamese" = "english";
      let resolvedEngine: "kokoro" | "piper" | "supertonic" = "supertonic";

      // Validate URL persona — exactly, since an id that is not a persona has to
      // fall back to the default rather than become a selection with no option
      // behind it. The catalog answers first, then the built-in list, so a deep
      // link resolves against either.
      if (urlPersona && findPersonaIn(offered, urlPersona)) {
        resolvedPersona = urlPersona;
      }

      // Validate URL lang
      if (urlLang === "english" || urlLang === "vietnamese") {
        resolvedLang = urlLang;
      }

      // Validate URL engine
      if (urlEngine === "kokoro" || urlEngine === "piper" || urlEngine === "supertonic") {
        resolvedEngine = urlEngine;
      }

      // If no valid URL params, use what this browser remembers (persistDraft).
      // The remembered persona counts only if it is exactly a persona, and the
      // remembered topics count only for the persona they were chosen for, since
      // this key outlives any particular persona.
      let rememberedTopics: string[] | undefined;
      if (!urlPersona && !urlLang && !urlEngine) {
        const stored = readStoredConfig();
        if (stored.personaId && findPersonaIn(offered, stored.personaId)) {
          resolvedPersona = stored.personaId;
        }
        if (stored.language === "english" || stored.language === "vietnamese") {
          resolvedLang = stored.language;
        }
        if (stored.engine === "kokoro" || stored.engine === "piper" || stored.engine === "supertonic") {
          resolvedEngine = stored.engine;
        }
        if (stored.personaId === resolvedPersona && Array.isArray(stored.enabledTopics)) {
          rememberedTopics = stored.enabledTopics.filter(
            (topic): topic is string => typeof topic === "string"
          );
        }
      }

      const persona = findPersonaIn(offered, resolvedPersona);
      const personaTopics = persona?.knowledgeTopics ? [...persona.knowledgeTopics] : [];
      setPersonas(offered);
      setLanguage(resolvedLang);
      setEngine(resolvedEngine);
      setPersonaId(resolvedPersona);
      // A remembered selection is intersected with the persona's topics, so a topic
      // that has since left the persona cannot be sent on its behalf. An explicitly
      // empty selection is restored as empty, not as "all of them".
      setEnabledTopics(
        rememberedTopics === undefined
          ? personaTopics
          : personaTopics.filter((topic) => rememberedTopics.includes(topic))
      );
      setSystemPrompt(persona?.defaultPrompt || "");
      setIsResolvingConfig(false);
    })();

    return () => {
      abandoned = true;
    };
  }, [searchParams]);

  // Auto-start conversation when config is resolved and conditions are met
  useEffect(() => {
    if (isResolvingConfig) return;
    if (hasAttemptedAutoStartRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (!systemPrompt.trim()) return;

    hasAttemptedAutoStartRef.current = true;

    void (async () => {
      try {
        await startConversation();
      } catch {
        setAutoStartFailed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResolvingConfig]);

  function forcePromptLanguage(prompt: string) {
    let pr = prompt.trim().concat(` Remember: - You always need to use ${language.charAt(0).toUpperCase() + language.slice(1)} for communication.`);
    if (language === "vietnamese") {
      pr = pr.concat(" - Khi nói về khoảng thời gian. Thay vì nói 8h-10h, thì phải nói là '8 giờ đến 10 giờ' - Các từ liên quan đến đơn vi đo lường, khối lượng, thời gian phải được đọc đầy đủ không được dùng ký hiệu viết tắt. - Ký tự '&' phải đọc là 'và'")
    }
    return pr;
  }

  function startThinkingTimer() {
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
    }
    setThinkingElapsed(0);
    thinkingTimerRef.current = setInterval(() => {
      setThinkingElapsed((prev) => prev + 1);
    }, 1000);
  }

  function stopThinkingTimer() {
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    setThinkingElapsed(0);
  }

  function cleanupStreamState() {
    if (sentenceQueueRef.current) {
      sentenceQueueRef.current.stop();
    }
    if (turnAbortRef.current) {
      turnAbortRef.current.abort();
      turnAbortRef.current = null;
    }
    seenSentenceIndicesRef.current.clear();
    pendingChunksRef.current.clear();
    nextExpectedIndexRef.current = 0;
    setStreamItems([]);
    setQueueIsPlaying(false);
    stopThinkingTimer();
  }

  function flushPendingChunks() {
    if (!sentenceQueueRef.current) return;
    let idx = nextExpectedIndexRef.current;
    const pendingKeys = Array.from(pendingChunksRef.current.keys()).sort((a, b) => a - b);
    console.log(`[VoiceAgent] flushPendingChunks nextExpected=${idx} pending=[${pendingKeys.join(",")}]`);
    while (pendingChunksRef.current.has(idx)) {
      const chunk = pendingChunksRef.current.get(idx)!;
      // The gate is read here rather than where the chunk arrived, so a mode
      // switch or a mute lands on the next sentence instead of on the next turn.
      // The index still advances either way: the queue's cursor is what keeps the
      // chunks in order, and a skipped one must not leave a hole in it.
      if (chunk.audio && wantsAudioRef.current) {
        console.log(`[VoiceAgent] Enqueue index=${idx} duration=${chunk.audio.duration} text="${chunk.text.substring(0, 40)}"`);
        sentenceQueueRef.current.enqueue(idx, chunk.audio, chunk.text);
      } else {
        console.log(`[VoiceAgent] Skip index=${idx} (${chunk.audio ? "not playing" : "no audio"}) text="${chunk.text.substring(0, 40)}"`);
      }
      pendingChunksRef.current.delete(idx);
      idx++;
    }
    nextExpectedIndexRef.current = idx;
    if (pendingKeys.length > 0 && idx <= Math.max(...pendingKeys)) {
      console.log(`[VoiceAgent] Still waiting for index=${idx}; held ${pendingKeys.filter(k => k >= idx).length} chunk(s)`);
    }
  }

  async function initAudioContext() {
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioCtxRef.current = new Ctx();
      }
    }
    if (audioCtxRef.current?.state === "suspended") {
      try {
        await audioCtxRef.current.resume();
      } catch {
        // ignore
      }
    }
  }

  function resetConversation() {
    cleanupStreamState();
    setConfig(null);
    setMessages([]);
    setError("");
    setNotice("");
    setLoading(false);
    setProcessing(false);
    setProcessingStep("");
    setStreamItems([]);
    setThinkingElapsed(0);
    setSpeakingMsgId(null);
    stopSpeaking();
  }

  async function startConversation() {
    if (!systemPrompt.trim()) {
      setError(t("errorNoPrompt"));
      return;
    }

    const newConfig: AgentConfig = {
      language,
      engine,
      personaId,
      systemPrompt: forcePromptLanguage(systemPrompt.trim()),
      enabledTopics,
      // The mode the persona declared, folded to the two values the server acts
      // on: a persona the catalog reports without one — or the built-in list,
      // which declares none — generates every reply, exactly as before this
      // capability existed.
      answerMode: resolveAnswerMode(findPersona(personaId)?.answerMode),
    };

    setConfig(newConfig);
    setMessages([]);
    setError("");
    setLoading(false);
    setAutoStartFailed(false);

    // Remember this session's config. Choices are already remembered as they are
    // made (persistDraft); recording the same thing here means what was last
    // started is also what is restored, topics included.
    persistDraft({
      personaId: newConfig.personaId,
      language: newConfig.language,
      engine: newConfig.engine,
      enabledTopics: newConfig.enabledTopics,
    });

    await initAudioContext();
    cleanupStreamState();
    await sendTurn(newConfig, [], null);
  }

  async function sendTurn(
    activeConfig: AgentConfig,
    currentMessages: AgentMessage[],
    input: { type: "audio"; blob: Blob; durationMs: number } | { type: "text"; text: string } | null
  ) {
    const myGen = ++turnGenerationRef.current;

    if (turnAbortRef.current) {
      turnAbortRef.current.abort();
      turnAbortRef.current = null;
    }

    await initAudioContext();

    if (sentenceQueueRef.current) {
      sentenceQueueRef.current.stop();
    }

    if (audioCtxRef.current) {
      sentenceQueueRef.current = new SentenceAudioQueue(audioCtxRef.current, {
        onStart: (index) => {
          console.log(`[VoiceAgent] Audio started index=${index}`);
          setQueueIsPlaying(true);
        },
        onEnd: (index) => {
          console.log(`[VoiceAgent] Audio ended index=${index}`);
        },
        onFinished: () => {
          console.log(`[VoiceAgent] Audio queue finished`);
          setQueueIsPlaying(false);
        },
        onError: (index, err) => {
          console.warn(`[VoiceAgent] Audio error index=${index}:`, err);
          setQueueIsPlaying(false);
        },
      });
    }

    // Reset per-turn streaming state
    seenSentenceIndicesRef.current.clear();
    pendingChunksRef.current.clear();
    nextExpectedIndexRef.current = 0;
    setStreamItems([]);
    setProcessing(true);
    setProcessingStep(input ? t("agentThinking") : t("agentStarting"));
    startThinkingTimer();
    setError("");
    // The previous turn's remark has been read by now, and this turn is a reply to
    // it — leaving it up would put it beside an answer it does not describe.
    setNotice("");

    const formData = new FormData();
    formData.append("language", activeConfig.language);
    formData.append("engine", activeConfig.engine);
    formData.append("systemPrompt", activeConfig.systemPrompt);
    formData.append(
      "history",
      JSON.stringify(
        currentMessages.map((m) => ({ role: m.role, content: m.content }))
      )
    );

    if (input?.type === "audio") {
      formData.append("audio", input.blob, "recording.wav");
    } else if (input?.type === "text") {
      formData.append("text", input.text);
      // A prefetch held for exactly this text is this turn's knowledge, already
      // in hand — so the backend skips its own search (D1). Consumed here:
      // whatever happens next, no later turn carries this id.
      const { prefetchId } = getPrefetch().turnFields(input.text);
      if (prefetchId) {
        formData.append("prefetchId", prefetchId);
      }
    }

    if (activeConfig.enabledTopics.length > 0) {
      formData.append("enabledTopics", JSON.stringify(activeConfig.enabledTopics));
    }

    // The persona's answer mode travels with every turn, because the server reads
    // it per turn and has no other way to know which persona this session is: the
    // catalog the client loaded is where it was declared. A server older than this
    // field ignores it and generates, which is what a client that does not send it
    // gets too — so a stale client against a new API, and a new client against an
    // old one, both behave as they did before.
    formData.append("answerMode", activeConfig.answerMode);

    // Told up front rather than left to be inferred: synthesis is the expensive
    // half of a turn and the bulk of what reaches the wire, so a client that will
    // not play the answer asks the server not to make it. Read from the ref, since
    // this is the value the turn's own gates will be using. The replay button still
    // works on such a turn — it re-synthesizes on demand through speak-stream.
    formData.append("speak", wantsAudioRef.current ? "1" : "0");

    const turnAbortCtrl = new AbortController();
    turnAbortRef.current = turnAbortCtrl;

    try {
      console.log("[VoiceAgent] Starting SSE to", `${BACKEND_URL}/api/voice-agent/stream`);
      const res = await apiFetch(`${BACKEND_URL}/api/voice-agent/stream`, {
        method: "POST",
        body: formData,
        signal: turnAbortCtrl.signal,
      });

      console.log("[VoiceAgent] SSE response status:", res.status, res.ok);
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || t("errorStartStream"));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentAgentText = "";
      const currentMessageId = `agent-${Date.now()}`;
      // Whether the server concluded this turn in-band. `done`, `notice` and
      // `error` all set it, and it is what tells "the turn ended" apart from "the
      // stream stopped" — from here those look identical, and only one of them
      // means the UI may go back to idle. A server that ends a turn with an event
      // this client does not know (a newer `notice`, say) would otherwise leave
      // the turn running forever, with the thinking counter climbing for a turn
      // that is over.
      let turnSettled = false;

      while (true) {
        if (myGen !== turnGenerationRef.current) {
          await reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const eventBlock of lines) {
          if (!eventBlock.trim()) continue;

          const eventLine = eventBlock.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = eventBlock.split("\n").find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.replace("event:", "").trim();
          const payload = dataLine.replace("data:", "").trim();

          try {
            const parsed = JSON.parse(payload);
            console.log(`[VoiceAgent] SSE event: ${eventName}`, parsed);

            switch (eventName) {
              case "user": {
                if (myGen !== turnGenerationRef.current) break;
                const u = parsed as UserEvent;
                const userMsg: AgentMessage = {
                  id: u.messageId || `user-${Date.now()}`,
                  role: "user",
                  content: u.text,
                  createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, userMsg]);
                setProcessingStep(t("agentThinking"));
                setThinkingElapsed(0);
                startThinkingTimer();
                break;
              }

              case "sentence": {
                if (myGen !== turnGenerationRef.current) break;
                stopThinkingTimer();
                const s = parsed as SentenceEvent;
                if (seenSentenceIndicesRef.current.has(s.index)) {
                  console.log(`[VoiceAgent] SSE duplicate sentence index=${s.index}`);
                  break;
                }
                seenSentenceIndicesRef.current.add(s.index);
                console.log(`[VoiceAgent] SSE sentence index=${s.index} audioData=${s.audioData ? "present" : "null"} text="${s.text.substring(0, 40)}"`);

                let audioBuffer: AudioBuffer | null = null;
                if (s.audioData && audioCtxRef.current && wantsAudioRef.current) {
                  try {
                    const binaryString = atob(s.audioData);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    audioBuffer = await audioCtxRef.current.decodeAudioData(bytes.buffer);
                    console.log(`[VoiceAgent] Decoded audio index=${s.index} duration=${audioBuffer.duration}`);
                  } catch (err) {
                    console.warn(`[VoiceAgent] Failed to decode audioData index=${s.index}:`, err);
                  }
                } else if (s.audioData && !wantsAudioRef.current) {
                  // The turn's `speak` ask is read once, at its start, so a mute
                  // applied mid-answer still arrives with audio — decoded for
                  // nothing unless the check is here too.
                  console.log(`[VoiceAgent] Not playing audio index=${s.index} (sound off)`);
                } else {
                  console.log(`[VoiceAgent] No audioData for index=${s.index}`);
                }

                pendingChunksRef.current.set(s.index, {
                  audio: audioBuffer,
                  text: s.text,
                });
                flushPendingChunks();
                setStreamItems((prev) => [
                  ...prev,
                  { index: s.index, text: s.text, audioUrl: null },
                ]);
                currentAgentText += s.text + " ";
                break;
              }

              case "done": {
                if (myGen !== turnGenerationRef.current) break;
                turnSettled = true;
                stopThinkingTimer();
                const d = parsed as DoneEvent;
                setProcessing(false);
                setProcessingStep("");

                const finalText = d.fullText || currentAgentText.trim();
                const agentMsg: AgentMessage = {
                  id: d.messageId || currentMessageId,
                  role: "agent",
                  content: finalText,
                  createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, agentMsg]);
                setStreamItems([]);
                break;
              }

              case "notice": {
                if (myGen !== turnGenerationRef.current) break;
                // Not an error and not a `done`: the server ended the turn without
                // an answer, and what it has to say is for the reader rather than
                // the console. The turn comes back to idle here rather than in the
                // catch below, because nothing threw. It settles the turn like a
                // `done` does — the stream is about to end, and the end of it is
                // not a separate fact to wait for.
                turnSettled = true;
                stopThinkingTimer();
                setProcessing(false);
                setProcessingStep("");
                setNotice(noticeText(parsed as NoticeEvent));
                break;
              }

              case "error": {
                if (myGen !== turnGenerationRef.current) break;
                turnSettled = true;
                const message = parsed.message || "Streaming error";
                console.error("[VoiceAgent] SSE error:", message);
                throw new Error(message);
              }
            }
          } catch (err) {
            // Malformed SSE data is skipped. Anything the switch itself threw is
            // not: `error` is reported by throwing, and swallowing that here made
            // every failed turn silent — no message, and a spinner that never
            // stopped, which is precisely what a user saw.
            if (!(err instanceof SyntaxError)) throw err;
          }
        }
      }

      // The stream ended. If no event concluded the turn, it is still marked as
      // running and the thinking counter is still climbing for a turn that is
      // over — the state a client one build behind the server was left in when
      // `notice` first appeared, since an unknown event name matches no case and
      // the end of the stream was then nobody's business. Settle it here instead,
      // and report it: a stream that ends with nothing to say is not a turn that
      // succeeded. Skipped when a newer turn has taken over, which owns the state.
      if (!turnSettled && myGen === turnGenerationRef.current) {
        console.warn("[VoiceAgent] Stream ended without concluding the turn");
        stopThinkingTimer();
        setProcessing(false);
        setProcessingStep("");
        setError(t("errorAgentResponse"));
      }
    } catch (err) {
      if (myGen !== turnGenerationRef.current) return;

      if (err instanceof Error && err.name === "AbortError") {
        setProcessing(false);
        setProcessingStep("");
        stopThinkingTimer();
        return;
      }

      console.error("[VoiceAgent] Turn error:", err);
      setError(err instanceof Error ? err.message : t("errorAgentResponse"));
      setProcessing(false);
      setProcessingStep("");
      stopThinkingTimer();
    } finally {
      if (turnAbortRef.current === turnAbortCtrl) {
        turnAbortRef.current = null;
      }
    }
  }

  async function handleRecordingComplete(blob: Blob, durationMs: number) {
    if (!config) return;
    await sendTurn(config, messages, { type: "audio", blob, durationMs });
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config || !textInput.trim() || processing) return;

    const text = textInput.trim();
    setTextInput("");
    await sendTurn(config, messages, { type: "text", text });
  }

  function cleanupSpeakState() {
    if (speakAbortRef.current) {
      speakAbortRef.current.abort();
      speakAbortRef.current = null;
    }
    speakPendingChunksRef.current.clear();
    speakNextExpectedIndexRef.current = 0;
    speakSeenSentenceIndicesRef.current.clear();
    speakStreamDoneRef.current = false;
  }

  function flushSpeakPendingChunks() {
    if (!sentenceQueueRef.current) return;
    let idx = speakNextExpectedIndexRef.current;
    while (speakPendingChunksRef.current.has(idx)) {
      const chunk = speakPendingChunksRef.current.get(idx)!;
      if (chunk.audio) {
        sentenceQueueRef.current.enqueue(idx, chunk.audio, chunk.text);
      }
      speakPendingChunksRef.current.delete(idx);
      idx++;
    }
    speakNextExpectedIndexRef.current = idx;
  }

  async function speakMessage(text: string, msgId: string) {
    if (!config) return;

    const currentGen = ++speakGenerationRef.current;

    if (speakingMsgId && speakingMsgId !== msgId) {
      stopSpeaking();
    }
    if (speakingMsgId === msgId) return;
    setSpeakingMsgId(msgId);

    await initAudioContext();
    cleanupSpeakState();
    speakStreamDoneRef.current = false;

    if (sentenceQueueRef.current) {
      sentenceQueueRef.current.stop();
    }

    if (audioCtxRef.current) {
      sentenceQueueRef.current = new SentenceAudioQueue(audioCtxRef.current, {
        onFinished: () => {
          if (speakStreamDoneRef.current) {
            cleanupSpeakState();
            setSpeakingMsgId(null);
          }
        },
      });
    }

    const abortCtrl = new AbortController();
    speakAbortRef.current = abortCtrl;

    try {
      const res = await apiFetch(`${BACKEND_URL}/api/voice/speak-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          engine: config.engine,
          language: config.language,
        }),
        signal: abortCtrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("SSE failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const eventBlock of lines) {
          if (!eventBlock.trim()) continue;

          const eventLine = eventBlock.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = eventBlock.split("\n").find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.replace("event:", "").trim();
          const payload = dataLine.replace("data:", "").trim();

          try {
            const parsed = JSON.parse(payload);

            switch (eventName) {
              case "sentence": {
                if (currentGen !== speakGenerationRef.current) break;
                const s = parsed as { index: number; text: string; audioData: string | null };
                if (speakSeenSentenceIndicesRef.current.has(s.index)) break;
                speakSeenSentenceIndicesRef.current.add(s.index);

                let audioBuffer: AudioBuffer | null = null;
                if (s.audioData && audioCtxRef.current) {
                  try {
                    const binaryString = atob(s.audioData);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    audioBuffer = await audioCtxRef.current.decodeAudioData(bytes.buffer);
                  } catch (err) {
                    console.warn("[VoiceAgent replay] Failed to decode audioData:", err);
                  }
                }

                speakPendingChunksRef.current.set(s.index, {
                  audio: audioBuffer,
                  text: s.text,
                });
                flushSpeakPendingChunks();
                break;
              }

              case "done": {
                if (currentGen !== speakGenerationRef.current) break;
                speakStreamDoneRef.current = true;
                if (
                  sentenceQueueRef.current &&
                  !sentenceQueueRef.current.getIsPlaying() &&
                  sentenceQueueRef.current.getQueueLength() === 0
                ) {
                  cleanupSpeakState();
                  setSpeakingMsgId(null);
                }
                break;
              }

              case "error": {
                throw new Error(parsed.message || "Streaming error");
              }
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      }

      speakAbortRef.current = null;

      if (
        currentGen === speakGenerationRef.current &&
        speakingMsgId === msgId &&
        sentenceQueueRef.current &&
        sentenceQueueRef.current.getQueueLength() === 0 &&
        !sentenceQueueRef.current.getIsPlaying()
      ) {
        cleanupSpeakState();
        setSpeakingMsgId(null);
      }
    } catch (err) {
      if (currentGen !== speakGenerationRef.current) return;
      if (err instanceof Error && err.name === "AbortError") {
        cleanupSpeakState();
        setSpeakingMsgId(null);
        return;
      }
      console.error("[VoiceAgent] Replay failed:", err);
      cleanupSpeakState();
      setSpeakingMsgId(null);
    }
  }

  function stopSpeaking() {
    speakGenerationRef.current++;
    cleanupSpeakState();
    if (sentenceQueueRef.current) {
      sentenceQueueRef.current.stop();
    }
    setSpeakingMsgId(null);
  }

  /**
   * Turn playback on or off, and make the change take effect now: the ref is what
   * the reading loop and the flush gate read, and cutting the sound short is the
   * other half of the request — a switch that left the current sentence playing
   * would be a switch to nothing.
   *
   * The per-message replay button is deliberately outside this. Clicking 🔊 on a
   * message is a request for *that* message, so it plays whatever the mode and the
   * mute say; this governs what arrives on its own.
   */
  function setWantsAudio(next: boolean) {
    wantsAudioRef.current = next;
    if (!next) {
      stopSpeaking();
    }
  }

  // What the controls show. `wantsAudioRef` is what playback obeys; this is the
  // same rule for display, and every writer of one writes the other.
  const wantsAudio = inputMode === "voice" && !muted;

  /**
   * What a `notice` event says, in the reader's language. The server sends a code
   * *and* its own English wording, so the code wins where this build knows it and
   * the wording is what an unrecognised one falls back to: a code added on the
   * server reaches this client as English rather than as nothing.
   */
  function noticeText(n: NoticeEvent): string {
    if (n.code === "no_speech") return t("noticeNoSpeech");
    return n.message ?? "";
  }

  // Configuration screen
  if (!config) {
    return (
      <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
        <div className="mx-auto max-w-xl">
          <Link
            href="/dashboard"
            className="mb-4 inline-block min-h-[44px] text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Back to Dashboard
          </Link>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {t("title")}
            </h1>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              {t("configureDescription")}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void startConversation();
              }}
              className="space-y-5"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("language")}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage("english");
                      setEngine("supertonic");
                      persistDraft({ language: "english", engine: "supertonic" });
                    }}
                    className={`flex-1 min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      language === "english"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    🇺🇸 English
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage("vietnamese");
                      setEngine("supertonic");
                      persistDraft({ language: "vietnamese", engine: "supertonic" });
                    }}
                    className={`flex-1 min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      language === "vietnamese"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    🇻🇳 Vietnamese
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("engine")}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEngine("supertonic");
                      persistDraft({ engine: "supertonic" });
                    }}
                    className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      engine === "supertonic"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {t("supertonic")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEngine("kokoro");
                      persistDraft({ engine: "kokoro" });
                    }}
                    className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      engine === "kokoro"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {t("kokoro")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEngine("piper");
                      persistDraft({ engine: "piper" });
                    }}
                    className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      engine === "piper"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {t("piper")}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("persona")}
                </label>
                <select
                  value={personaId}
                  onChange={(e) => {
                    const id = e.target.value;
                    // Changing persona resets the topics to that persona's own
                    // (all enabled) — a selection belongs to the persona it was
                    // made for — and remembers both.
                    const persona = findPersona(id);
                    const topics = persona?.knowledgeTopics ? [...persona.knowledgeTopics] : [];
                    setPersonaId(id);
                    if (persona) {
                      setSystemPrompt(persona.defaultPrompt);
                    }
                    setEnabledTopics(topics);
                    persistDraft({ personaId: id, enabledTopics: topics });
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {findPersona(personaId)?.knowledgeTopics && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Knowledge Topics
                  </label>
                  <div className="space-y-2">
                    {findPersona(personaId)!.knowledgeTopics!.map((topic) => (
                      <label
                        key={topic}
                        className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={enabledTopics.includes(topic)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? enabledTopics.includes(topic)
                                ? enabledTopics
                                : [...enabledTopics, topic]
                              : enabledTopics.filter((t) => t !== topic);
                            setEnabledTopics(next);
                            persistDraft({ enabledTopics: next });
                          }}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                          {topic}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Enable topics to retrieve relevant knowledge during the conversation.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("systemPrompt")}
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={t("describeBehavior")}
                  rows={5}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {t("personaHint")}
                </p>
              </div>

              {autoStartFailed && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  <p className="font-medium">{t("autoStartFailed")}</p>
                  <p className="mt-1 text-xs opacity-80">{t("autoStartFailedHint")}</p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !systemPrompt.trim()}
                className="w-full min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? t("starting") : t("startConversation")}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Chat screen
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 sm:text-lg">
                {t("title")}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {personaFor(config.personaId).emoji} {personaFor(config.personaId).label} ·{" "}
                {config.language === "english" ? "🇺🇸 English" : "🇻🇳 Vietnamese"} ·{" "}
                {config.engine === "kokoro" ? "🎵 Kokoro" : config.engine === "piper" ? "🔊 Piper" : "🎙️ Supertonic"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/voice-agent/history"
                className="min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {t("history")}
              </Link>
              <button
                onClick={resetConversation}
                className="min-h-[44px] rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t("newConversation")}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 md:py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : "bg-white text-zinc-900 shadow-sm border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:border-zinc-700"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium opacity-70">
                    {msg.role === "agent" ? t("agentLabel") : t("youLabel")}
                  </span>
                  {msg.role === "agent" && (
                    <button
                      onClick={() =>
                        speakingMsgId === msg.id ? stopSpeaking() : speakMessage(msg.content, msg.id)
                      }
                      disabled={speakingMsgId !== null && speakingMsgId !== msg.id}
                      className={`text-xs leading-none ${
                        speakingMsgId === msg.id
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      } disabled:opacity-40`}
                    >
                      {speakingMsgId === msg.id ? `⏹ ${t("stop")}` : `🔊 ${t("speak")}`}
                    </button>
                  )}
                </div>
                {msg.role === "agent" ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {streamItems.length > 0 && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <span className="mb-1 block text-xs font-medium opacity-70">{t("agentLabel")}</span>
                <div className="space-y-1">
                  {streamItems.map((item) => (
                    <p key={item.index} className="text-zinc-800 dark:text-zinc-200">
                      {item.text}
                    </p>
                  ))}
                  {queueIsPlaying && (
                    <div className="flex items-center gap-1 py-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {processing && streamItems.length === 0 && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <span className="mb-1 block text-xs font-medium opacity-70">{t("agentLabel")}</span>
                <div className="flex items-center gap-1 py-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {processingStep}
                  {thinkingElapsed > 0 && (
                    <span className="ml-1 tabular-nums">({thinkingElapsed}s)</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {notice && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              {notice}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInputMode("voice");
                // Picking the voice mode is not the same as wanting to be spoken
                // to: text mode's silence is the mode's, and this restores whatever
                // the mute says separately.
                setWantsAudio(!muted);
                noteDraft("voice", textInput);
              }}
              className={`min-h-[44px] rounded-lg border px-3 py-1.5 text-sm ${
                inputMode === "voice"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              🎙️ {t("voice")}
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode("text");
                // Text mode is silent, and it says so rather than being silent by
                // accident: what is playing now stops, and the answer being streamed
                // arrives as text. The 🔊 on any message is still the way to hear it.
                setWantsAudio(false);
                noteDraft("text", textInput);
              }}
              className={`min-h-[44px] rounded-lg border px-3 py-1.5 text-sm ${
                inputMode === "text"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              ⌨️ {t("text")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (wantsAudio) {
                  setMuted(true);
                  setWantsAudio(false);
                  return;
                }
                // Turning sound back on says something about the mode too: sound
                // only exists in the voice mode, so this is one control for one
                // state rather than two controls that can disagree.
                setInputMode("voice");
                setMuted(false);
                setWantsAudio(true);
                noteDraft("voice", textInput);
              }}
              className={`min-h-[44px] rounded-lg border px-3 py-1.5 text-sm ${
                wantsAudio
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {wantsAudio ? t("soundOn") : t("soundOff")}
            </button>
          </div>

          {inputMode === "voice" ? (
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              onUserGesture={() => {
                void initAudioContext();
              }}
              disabled={processing}
            />
          ) : (
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  noteDraft("text", e.target.value);
                }}
                placeholder={t("typeMessage")}
                disabled={processing}
                className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={processing || !textInput.trim()}
                className="min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t("send")}
              </button>
            </form>
          )}
        </div>
      </footer>
    </div>
  );
}
