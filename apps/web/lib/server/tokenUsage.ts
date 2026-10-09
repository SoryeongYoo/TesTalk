import type Anthropic from "@anthropic-ai/sdk";

/**
 * Claude API 호출의 토큰 사용량을 비용 측정용으로 남긴다.
 * 한 줄짜리 JSON(`[token-usage] {...}`)으로 찍어 CloudWatch 등에서 grep/집계하기 쉽게 한다.
 *
 * 파싱 실패로 버려지는 응답도 토큰은 과금되므로, 호출부는 응답을 받자마자
 * (파싱/검증 전에) 이 함수를 부른다.
 */

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
}

/** 여러 호출로 이뤄진 작업(시험 1세트 생성 등)의 합계를 남긴다. */
export function logTokenUsageTotals(
  feature: TokenUsageFeature,
  model: string,
  totals: TokenUsageTotals,
  context: Record<string, string | number | boolean> = {},
): void {
  console.log(`[token-usage-total] ${JSON.stringify({ feature, model, ...totals, ...context })}`);
}
