import { and, eq, gte, sql } from "drizzle-orm";
import { db, aiUsageTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

export type AiFeature = "program_generation" | "task_alternatives" | "nutrition_extraction";
export type AiCaller = { type: "coach" | "client"; id: number };

export class AiGatewayError extends Error {
  constructor(
    public readonly category: "DAILY_LIMIT" | "TIMEOUT" | "UPSTREAM_RATE_LIMIT" | "UNAVAILABLE" | "INVALID_RESPONSE" | "CONFIGURATION",
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function modelFor(feature: AiFeature): string {
  const defaults: Record<AiFeature, string> = {
    program_generation: "gpt-4o-mini",
    task_alternatives: "gpt-4o-mini",
    nutrition_extraction: "gpt-5-mini",
  };
  const names: Record<AiFeature, string> = {
    program_generation: "AI_PROGRAM_MODEL",
    task_alternatives: "AI_TASK_ALTERNATIVES_MODEL",
    nutrition_extraction: "AI_NUTRITION_MODEL",
  };
  return process.env[names[feature]] ?? defaults[feature];
}

export function getAiGatewayConfig() {
  return {
    provider: process.env.AI_PROVIDER ?? "openai",
    timeoutMs: positiveEnv("AI_TIMEOUT_MS", 30_000),
    dailyCap: positiveEnv("AI_DAILY_CAP", 25),
    models: {
      programGeneration: modelFor("program_generation"),
      taskAlternatives: modelFor("task_alternatives"),
      nutritionExtraction: modelFor("nutrition_extraction"),
    },
  };
}

function normalizeProviderError(error: unknown): AiGatewayError {
  const value = error as { status?: number; name?: string; code?: string };
  if (
    value?.name === "AbortError" ||
    value?.name === "TimeoutError" ||
    value?.name === "APIConnectionTimeoutError" ||
    value?.code === "ETIMEDOUT"
  ) {
    return new AiGatewayError("TIMEOUT", "AI request timed out. Please try again.");
  }
  if (value?.status === 429) return new AiGatewayError("UPSTREAM_RATE_LIMIT", "AI is busy. Please try again shortly.", 30);
  if (value?.status && value.status >= 500) return new AiGatewayError("UNAVAILABLE", "AI service is temporarily unavailable. Please try again.");
  return new AiGatewayError("UNAVAILABLE", "AI service is unavailable. Please try again.");
}

function utcDayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function actorCaller(actor: Express.Request["actor"]): AiCaller {
  if (!actor) throw new AiGatewayError("CONFIGURATION", "Authenticated AI caller is required.");
  return actor.type === "coach"
    ? { type: "coach", id: actor.coach.id }
    : { type: "client", id: actor.client.id };
}

export async function requestAiJson<T>(input: {
  caller: AiCaller;
  feature: AiFeature;
  maxCompletionTokens: number;
  messages: any[];
  responseFormat?: { type: "json_object" };
  parse: (content: string) => T;
}): Promise<T> {
  const config = getAiGatewayConfig();
  const provider = config.provider;
  const model = modelFor(input.feature);
  if (provider !== "openai") throw new AiGatewayError("CONFIGURATION", "Configured AI provider is not supported.");
  const dailyCap = config.dailyCap;
  const startedAt = Date.now();
  let usageId: number | undefined;

  try {
    await db.transaction(async (tx) => {
      // Serialize cap checks per authenticated user across API processes.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.caller.type}), ${input.caller.id})`);
      const counted = await tx
        .select({ id: aiUsageTable.id })
        .from(aiUsageTable)
        .where(and(
          eq(aiUsageTable.callerType, input.caller.type),
          eq(aiUsageTable.callerId, input.caller.id),
          gte(aiUsageTable.occurredAt, utcDayStart()),
        ));
      if (counted.length >= dailyCap) throw new AiGatewayError("DAILY_LIMIT", "Daily AI request limit reached. Please try again tomorrow.", 60 * 60);
      const [usage] = await tx.insert(aiUsageTable).values({
        callerType: input.caller.type,
        callerId: input.caller.id,
        feature: input.feature,
        outcome: "started",
        provider,
        model,
      }).returning({ id: aiUsageTable.id });
      usageId = usage.id;
    });
  } catch (error) {
    if (error instanceof AiGatewayError) throw error;
    throw new AiGatewayError("UNAVAILABLE", "AI usage service is unavailable. Please try again.");
  }

  const timeout = AbortSignal.timeout(config.timeoutMs);
  try {
    const response = await openai.chat.completions.create({
      model,
      max_completion_tokens: input.maxCompletionTokens,
      ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
      messages: input.messages,
    }, { signal: timeout });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new AiGatewayError("INVALID_RESPONSE", "AI returned an invalid response. Please try again.");
    let parsed: T;
    try {
      parsed = input.parse(content);
    } catch {
      throw new AiGatewayError("INVALID_RESPONSE", "AI returned an invalid response. Please try again.");
    }
    await db.update(aiUsageTable).set({
      outcome: "success",
      promptTokens: response.usage?.prompt_tokens ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      totalTokens: response.usage?.total_tokens ?? null,
      durationMs: Date.now() - startedAt,
    }).where(eq(aiUsageTable.id, usageId!));
    return parsed;
  } catch (error) {
    const normalized = error instanceof AiGatewayError ? error : normalizeProviderError(error);
    // A failed audit update must not hide the normalized provider outcome.
    await db.update(aiUsageTable).set({
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      errorCategory: normalized.category,
    }).where(eq(aiUsageTable.id, usageId!)).catch(() => undefined);
    throw normalized;
  }
}

export function sendAiError(res: import("express").Response, error: unknown): boolean {
  if (!(error instanceof AiGatewayError)) return false;
  const status = error.category === "DAILY_LIMIT" || error.category === "UPSTREAM_RATE_LIMIT" ? 429
    : error.category === "TIMEOUT" ? 504
      : error.category === "INVALID_RESPONSE" ? 502 : 503;
  if (error.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
  const codes: Record<AiGatewayError["category"], string> = {
    DAILY_LIMIT: "AI_DAILY_CAP",
    TIMEOUT: "AI_TIMEOUT",
    UPSTREAM_RATE_LIMIT: "AI_PROVIDER_ERROR",
    UNAVAILABLE: "AI_PROVIDER_ERROR",
    INVALID_RESPONSE: "AI_INVALID_RESPONSE",
    CONFIGURATION: "AI_CONFIG_ERROR",
  };
  res.status(status).json({
    error: error.message,
    code: codes[error.category],
    ...(error.retryAfter ? { retryAfterSeconds: error.retryAfter } : {}),
  });
  return true;
}