/**
 * 설문(/survey) 완료 결과를 난이도 선택(/level) 화면으로 넘기기 위한
 * 아주 단순한 클라이언트 저장소. sessionStorage에 surveyTopics 배열만 담는다.
 *
 * ⚠️ 브라우저 전용. "use client" 컴포넌트에서만 import한다 — 서버(Server
 * Action/Route Handler)에는 sessionStorage가 없다.
 *
 * Next.js는 라우터 state(React Router의 location.state 같은 것)를 제공하지 않으므로,
 * 라우트 이동(설문 → 난이도) 사이에 값을 들고 가려면 이런 저장소가 필요하다.
 * sessionStorage를 쓰는 이유: 탭을 새로고침해도 유지되고, 탭을 닫으면 자연히
 * 사라져 이전 회차의 설문 결과가 다음 방문에 남지 않는다.
 */

const STORAGE_KEY = "testalk:surveyTopics";

/** 설문 완료 시 최종 surveyTopics 배열을 저장한다. */
export function saveSurveyTopics(topics: readonly string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
  } catch {
    // 프라이빗 모드 등으로 sessionStorage를 못 쓰는 경우 — 조용히 무시한다.
    // (난이도 화면에서 loadSurveyTopics()가 null을 받아 "설문을 먼저 완료해주세요"로 안내한다.)
  }
}

/** 저장된 surveyTopics 배열을 읽는다. 저장된 값이 없거나 읽기 실패 시 null. */
export function loadSurveyTopics(): string[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 설문을 다시 작성하기로 한 경우 등, 이전 결과를 지운다. */
export function clearSurveyTopics(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시 — 지우지 못해도 다음 저장(saveSurveyTopics)이 덮어쓴다.
  }
}
