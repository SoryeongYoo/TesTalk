import type Anthropic from "@anthropic-ai/sdk";

/**
 * Claude API 호출의 토큰 사용량을 비용 측정용으로 남긴다.
 * 한 줄짜리 JSON(`[token-usage] {...}`)으로 찍어 CloudWatch 등에서 grep/집계하기 쉽게 한다.
 *
 * 파싱 실패로 버려지는 응답도 토큰은 과금되므로, 호출부는 응답을 받자마자
 * (파싱/검증 전에) 이 함수를 부른다.
 */

/** Haiku 4.5 단가 (2026-10 기준, USD / 1M tokens). 캐시 토큰은 단가가 달라 비용 계산에 포함하지 않는다. */
export const HAIKU_INPUT_PRICE_PER_MTOK = 1.0;
export const HAIKU_OUTPUT_PRICE_PER_MTOK = 5.0;

export type TokenUsageFeature = "generateTestSet" | "evaluateAnswer";

export interface TokenUsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export function createTokenUsageTotals(): TokenUsageTotals {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };
}

/** API 호출 1건의 사용량을 로그로 남기고, totals가 있으면 누적한다. */
export function logTokenUsage(
  feature: TokenUsageFeature,
  model: string,
  usage: Anthropic.Messages.Usage,
  context: Record<string, string | number> = {},
  totals?: TokenUsageTotals,
): void {
  // 로깅 실패가 실제 응답(생성/피드백)에 영향을 주지 않도록 절대 throw하지 않는다.
  try {
    const entry = {
      feature,
      model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      ...context,
    };
    console.log(`[token-usage] ${JSON.stringify(entry)}`);

    if (totals) {
      totals.calls += 1;
      totals.inputTokens += entry.inputTokens;
      totals.outputTokens += entry.outputTokens;
      totals.cacheCreationInputTokens += entry.cacheCreationInputTokens;
      totals.cacheReadInputTokens += entry.cacheReadInputTokens;
    }
  } catch (err) {
    console.warn(`[token-usage] 로깅 실패: ${(err as Error)?.message}`);
  }
}

/** 여러 호출로 이뤄진 작업(시험 1세트 생성 등)의 합계를 남긴다. */
export function logTokenUsageTotals(
  feature: TokenUsageFeature,
  model: string,
  totals: TokenUsageTotals,
  context: Record<string, string | number | boolean> = {},
): void {
  try {
    const { inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens } = totals;
    const costUsd =
      (inputTokens / 1_000_000) * HAIKU_INPUT_PRICE_PER_MTOK +
      (outputTokens / 1_000_000) * HAIKU_OUTPUT_PRICE_PER_MTOK;

    // 캐시 토큰은 실제로 쓰인 경우에만 찍는다 (단가가 달라 나중에 정확한 원가 계산에 필요).
    const cacheParts = [
      cacheReadInputTokens > 0 ? `cache_read=${cacheReadInputTokens}` : "",
      cacheCreationInputTokens > 0 ? `cache_creation=${cacheCreationInputTokens}` : "",
    ].filter(Boolean);
    const extraParts = Object.entries({ calls: totals.calls, model, ...context }).map(
      ([key, value]) => `${key}=${value}`,
    );

    console.log(
      [
        `[token-usage-total] ${feature} input=${inputTokens} output=${outputTokens}`,
        ...cacheParts,
        `cost=$${costUsd.toFixed(5)}`,
        ...extraParts,
      ].join(" "),
    );
  } catch {
    // 로깅 실패는 무시한다 — finally에서 호출되므로 여기서 throw하면 실제 결과를 덮어쓴다.
  }
}
