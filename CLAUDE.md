# TesTalk — 프로젝트 불변 규칙

이 문서는 AI 오픽 모의고사 서비스(TesTalk)에서 **절대 깨져서는 안 되는 규칙**을 정의한다.
기능을 구현하거나 리뷰할 때 아래 규칙과 충돌하는 코드는 규칙이 아니라 코드를 고친다.

기획 배경·상세 설계(설문 구조, 프롬프트 템플릿, 로드맵 등)는 [docs/PLAN.md](docs/PLAN.md) 참조.

## 1. 시험 형식은 blueprint가 소유한다

15문항의 순서·유형(function)·그룹 구조는 `packages/shared/src/blueprint.ts`의
`OPIC_BLUEPRINT`가 유일한 정의처다. 다른 코드(프론트, API, 프롬프트 생성기)는
이 값을 **참조만** 하고, 슬롯 번호나 순서를 자체적으로 하드코딩하지 않는다.

## 2. AI는 슬롯 텍스트만 생성한다

AI 생성 파이프라인은 blueprint가 지정한 슬롯의 `text_en`/`text_ko`(문항 텍스트)만
채운다. 슬롯 번호, 유형(function), 순서, 문항 개수는 AI 출력이 아니라 앱(코드)이
결정하고 주입한다. AI가 반환한 `slot_no`/`function`은 신뢰하지 않고 validator로
반드시 대조한다.

## 3. 세트 단위 topic 일관성

콤보1~3(슬롯 2~4, 5~7, 8~10), 롤플레이(슬롯 11~13)는 세트 내 모든 문항이
**동일한 topic**을 공유해야 한다. 이 규칙은 `TOPIC_CONSISTENT_GROUPS`
(`packages/shared/src/blueprint.ts`)로 선언되고 `validateOpicQuestionSet`이 검사한다.
intro(1번), advanced(14~15번)는 문항별 독립 topic을 허용한다.

## 4. 생성 결과는 validator를 반드시 통과해야 한다

AI가 생성한 문제 세트는 `packages/shared/src/validator.ts`의
`validateOpicQuestionSet()`을 통과해야만 사용자에게 노출/저장할 수 있다.
검증 실패 시 전체 재호출이 아니라 **문제가 된 세트만 재생성**한다 (`docs/PLAN.md` 4-5).
validator를 우회하거나 결과를 신뢰 없이 통과시키는 코드는 추가하지 않는다.

## 5. 전부 TypeScript + Zod, single source of truth

- 스키마는 `packages/shared/src/schema.ts`의 Zod 스키마가 유일한 정의처다.
  `OpicQuestionSchema`/`OpicQuestionSetSchema`를 우회하는 별도 검증 로직을 만들지 않는다.
- enum(`function` 등)은 `blueprint.ts`의 `OPIC_FUNCTIONS`가 단일 출처이며,
  `schema.ts`는 `z.enum(OPIC_FUNCTIONS)`로 파생만 한다. 같은 enum을 다른 곳에
  다시 나열하지 않는다.
- `packages/shared`는 `apps/web`(과 향후 API)이 공유하는 유일한 타입/스키마
  출처다. 프론트·API에서 문항 형식과 관련된 타입을 자체 재정의하지 않는다.
