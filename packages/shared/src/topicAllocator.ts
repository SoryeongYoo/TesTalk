import { TOPIC_ALLOCATION_GROUPS, type TopicAllocationGroup } from "./blueprint";
import type { OpicSource } from "./schema";
import { SURPRISE_TOPIC_POOL } from "./topicPool";

/**
 * Self-Assessment 난이도(1~6단계). (참고: docs/PLAN.md 2-1)
 * 1~2단계(12문항 모드)는 아직 미구현이라 allocateTopics가 에러를 던진다.
 */
export type OpicDifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** 한 세트(콤보/롤플레이/어드밴스)에 배정된 topic과 source. */
export interface TopicAllocationEntry {
  topic: string;
  source: OpicSource;
}

/** TOPIC_ALLOCATION_GROUPS의 각 그룹 → 배정 결과. */
export type TopicAllocationResult = Record<
  TopicAllocationGroup,
  TopicAllocationEntry
>;

export interface AllocateTopicsOptions {
  /**
   * 지정하면 이 값으로 초기화한 결정적(deterministic) PRNG를 사용한다 (테스트용).
   * 미지정 시 Math.random을 사용해 매번 다른 결과를 낸다.
   */
  seed?: number;
}

const REQUIRED_TOPIC_COUNT = TOPIC_ALLOCATION_GROUPS.length;

/**
 * 사용자 설문 선택 + 난이도를 받아 blueprint의 각 세트(콤보1~3/롤플레이/어드밴스)에
 * topic과 source(survey|surprise)를 배정한다. AI 호출이 없는 순수 함수 —
 * 같은 입력 + 같은 seed면 항상 같은 결과를 반환한다.
 *
 * 배정 규칙 (참고: docs/PLAN.md 2-3, 4-2 Topic Allocator):
 *  - 콤보1~3: [설문:돌발] 비율을 2:1 또는 1:2 중 랜덤으로 정해 3세트에 배분
 *  - 롤플레이: 돌발 풀에서 우선 배정
 *  - 어드밴스: 설문/돌발 무관 (남은 풀에서 아무거나)
 *  - 세트 간 topic 중복 금지 (같은 topic이 두 세트에 배정되지 않음)
 *  - 특정 세트에 배정할 설문 주제가 부족하면 돌발 풀로 채우고, 그마저 부족하면 에러
 *
 * @param surveyTopics 사용자가 설문(여가/취미/운동/여행 등)에서 선택한 항목 문자열 목록.
 * @param difficulty Self-Assessment 난이도(1~6). 1~2단계(12문항 모드)는 아직 미지원.
 * @param options.seed 지정 시 결정적 PRNG(mulberry32) 사용. 테스트에서 결과를 고정할 때 쓴다.
 */
export function allocateTopics(
  surveyTopics: readonly string[],
  difficulty: OpicDifficultyLevel,
  options: AllocateTopicsOptions = {},
): TopicAllocationResult {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 6) {
    throw new Error(
      `[allocateTopics] difficulty는 1~6 사이의 정수여야 합니다. 실제: ${difficulty}`,
    );
  }
  if (difficulty <= 2) {
    throw new Error(
      `[allocateTopics] 난이도 1~2단계(12문항 모드, 어드밴스 없음)는 아직 지원하지 않습니다. ` +
        `(참고: docs/PLAN.md 2-4) 실제: ${difficulty}`,
    );
  }

  const rng = options.seed !== undefined ? mulberry32(options.seed) : Math.random;

  const surveyPool = dedupe(surveyTopics);
  // 돌발 풀에서 설문과 겹치는 topic은 제외해 두 풀이 서로소가 되도록 만든다.
  // (splice로 소비만 하면 되고, 별도의 "이미 쓴 topic" 집합을 추적하지 않아도 중복이 없다.)
  const surprisePool = dedupe(SURPRISE_TOPIC_POOL).filter(
    (topic) => !surveyPool.includes(topic),
  );

  const totalAvailable = surveyPool.length + surprisePool.length;
  if (totalAvailable < REQUIRED_TOPIC_COUNT) {
    throw new Error(
      `[allocateTopics] 배정 가능한 topic이 부족합니다. ` +
        `필요 ${REQUIRED_TOPIC_COUNT}개, 가용 ${totalAvailable}개 ` +
        `(설문 ${surveyPool.length}개 + 돌발 ${surprisePool.length}개).`,
    );
  }

  const result = {} as Record<TopicAllocationGroup, TopicAllocationEntry>;

  // 1) 콤보1~3: [설문:돌발] = 2:1 또는 1:2 랜덤 배분.
  const surveyComboCount: 1 | 2 = rng() < 0.5 ? 2 : 1;
  const surpriseComboCount = 3 - surveyComboCount;
  const comboSourceOrder = shuffle(
    [
      ...Array.from({ length: surveyComboCount }, (): OpicSource => "survey"),
      ...Array.from({ length: surpriseComboCount }, (): OpicSource => "surprise"),
    ],
    rng,
  );
  const comboGroups: readonly TopicAllocationGroup[] = ["combo1", "combo2", "combo3"];
  comboGroups.forEach((group, i) => {
    result[group] = pickTopic(group, comboSourceOrder[i]!, surveyPool, surprisePool, rng);
  });

  // 2) 롤플레이: 돌발 풀 우선 배정 (없으면 설문으로 폴백).
  result.roleplay = pickTopic("roleplay", "surprise", surveyPool, surprisePool, rng);

  // 3) 어드밴스: 설문/돌발 무관 — 우선순위를 랜덤으로 정해 남은 풀에서 배정.
  const advancedPreferred: OpicSource = rng() < 0.5 ? "survey" : "surprise";
  result.advanced = pickTopic("advanced", advancedPreferred, surveyPool, surprisePool, rng);

  return result;
}

/**
 * 선호 source 풀에서 topic 하나를 뽑는다. 선호 풀이 비어 있으면 반대 풀로 폴백하고,
 * 두 풀 다 비어 있으면 에러를 던진다. 인자로 받은 풀 배열을 직접 소비(splice)한다.
 */
function pickTopic(
  group: TopicAllocationGroup,
  preferred: OpicSource,
  surveyPool: string[],
  surprisePool: string[],
  rng: () => number,
): TopicAllocationEntry {
  const pools: Record<OpicSource, string[]> = {
    survey: surveyPool,
    surprise: surprisePool,
  };
  const fallback: OpicSource = preferred === "survey" ? "surprise" : "survey";

  if (pools[preferred].length > 0) {
    return { topic: takeRandom(pools[preferred], rng), source: preferred };
  }
  if (pools[fallback].length > 0) {
    return { topic: takeRandom(pools[fallback], rng), source: fallback };
  }
  throw new Error(
    `[allocateTopics] '${group}' 세트에 배정할 topic이 남아있지 않습니다. 설문/돌발 풀이 모두 소진되었습니다.`,
  );
}

/** 문자열 배열을 앞뒤 공백 제거 + 중복 제거해서 새 배열로 반환한다. */
function dedupe(topics: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of topics) {
    const topic = raw.trim();
    if (topic.length === 0 || seen.has(topic)) continue;
    seen.add(topic);
    result.push(topic);
  }
  return result;
}

/** pool에서 무작위 원소 하나를 골라 배열에서 제거하고 반환한다 (pool을 직접 변형). */
function takeRandom(pool: string[], rng: () => number): string {
  const index = Math.floor(rng() * pool.length);
  const [topic] = pool.splice(index, 1);
  return topic!;
}

/** Fisher-Yates 셔플. 원본 배열은 건드리지 않고 새 배열을 반환한다. */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * 시드 기반 결정적 PRNG (mulberry32). 테스트에서 allocateTopics 결과를
 * 고정해 검증하기 위해서만 사용한다. 암호학적으로 안전하지 않음.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
