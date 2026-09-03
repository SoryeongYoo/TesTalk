/**
 * 돌발(surprise) 주제 풀.
 * Background Survey 선택과 무관하게 앱이 항상 보유하는 고정 주제 목록.
 * (참고: docs/PLAN.md 3. "돌발 주제 풀")
 */
export const SURPRISE_TOPIC_POOL = [
  "은행",
  "병원",
  "호텔",
  "대중교통",
  "인터넷/기술",
  "재활용",
  "날씨/계절",
  "명절",
  "패션",
  "가구",
  "전화 통화",
  "약속",
  "외식/음식점",
  "도서관",
  "건강",
  "카페",
  "동네/지역",
] as const;

export type SurpriseTopic = (typeof SURPRISE_TOPIC_POOL)[number];
