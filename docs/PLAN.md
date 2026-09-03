# AI 오픽 모의고사 서비스 기획서

> 배경설문(Background Survey) 선택에 맞춰 **실제 오픽과 동일한 문제 순서·유형**으로,
> AI가 매번 새로운 문제를 랜덤 생성하는 모의고사 웹 서비스.

---

## 1. 서비스 개요

| 항목 | 내용 |
|------|------|
| 한 줄 정의 | 내 배경설문에 맞춘 오픽 시험을, AI가 실전과 똑같은 구성·유형으로 무한 생성해주는 모의고사 |
| 핵심 가치 | ① 실제 오픽 **형식 100% 준수** ② 매번 **새로운 문제**(암기 방지) ③ 내 설문 기반 **맞춤 출제** |
| 타겟 | 오픽 IH~AL 목표 취준생 / 재응시자 / 회사 어학 평가 대비자 |
| 차별점 | 기존 앱들이 "고정 문제 은행"을 돌려쓰는 것과 달리, **매 세션 AI 생성 + 형식 강제 스키마**로 실전 감각 + 무한 변주 |

### 왜 AI 생성인가
- 실제 오픽은 응시자 배경·관심사에 맞춰 개별 맞춤 출제됨 → 정적 문제 은행으로는 재현 한계
- 기출 문제를 그대로 복제하면 **저작권/상표 리스크** → "유형은 동일하되 문제는 AI가 새로 작성"으로 회피
- 같은 유형을 반복 연습하려면 변주된 문제가 계속 필요 → 생성형이 최적

---

## 2. 오픽 시험 구조 (반드시 이 형식을 강제할 것)

### 2-1. 난이도별 문항 수

| Self-Assessment 난이도 | 문항 수 | 특징 |
|------|------|------|
| 1~2단계 | **12문항** | 쉬운 문제, 짧은 답변, 롤플레이 축소, 어드밴스 없음 |
| 3~4단계 | **15문항** | 롤플레이 + 돌발 섞임 (표준) |
| 5~6단계 | **15문항** | 고난도 주제, 조건 많은 문제, 어드밴스 포함 |

> **MVP는 15문항(난이도 3~5) 기준**으로 만들고, 12문항 모드는 확장으로.

### 2-2. 15문항 표준 구성 (앱이 소유하는 "고정 뼈대")

| 번호 | 세트 | 유형(Function) | 주제 출처 | 예시 지시 |
|------|------|------|------|------|
| **1** | 자기소개 | Self-Introduction | 고정 | "Let's start the interview. Tell me about yourself." |
| **2** | 콤보 1 | 묘사 (Description) | 설문/돌발 | 장소·사물·사람 묘사 |
| **3** | 콤보 1 | 습관·루틴 or 비교 | 콤보1과 동일 주제 | 평소 루틴 / 과거와 비교 |
| **4** | 콤보 1 | 과거 경험 (Past Experience) | 콤보1과 동일 주제 | 기억에 남는 경험 |
| **5** | 콤보 2 | 묘사 | 설문/돌발 | (콤보1과 다른 주제) |
| **6** | 콤보 2 | 습관·루틴 or 비교 | 콤보2와 동일 주제 | |
| **7** | 콤보 2 | 과거 경험 | 콤보2와 동일 주제 | |
| **8** | 콤보 3 | 묘사 | 설문/돌발 | |
| **9** | 콤보 3 | 습관·루틴 or 비교 | 콤보3과 동일 주제 | |
| **10** | 콤보 3 | 과거 경험 | 콤보3과 동일 주제 | |
| **11** | 롤플레이 | 질문하기 (Ask Questions) | 돌발(주로) | 상황 주고 3~4개 질문 |
| **12** | 롤플레이 | 문제 해결 (Solve a Problem) | 11과 동일 주제 | 돌발 상황 → 대안 제시 |
| **13** | 롤플레이 | 관련 경험 (Related Experience) | 11과 동일 주제 | 비슷했던 실제 경험 |
| **14** | 어드밴스 | 비교/변화 (Comparison) | 설문/돌발 | 과거 vs 현재 |
| **15** | 어드밴스 | 이슈/트렌드 (Issue) | 14와 동일 주제 | 사회 이슈·의견 |

**콤보 세트 내부 3단 패턴**은 고정: `묘사 → (습관/비교) → 과거경험`. 첫 문제는 항상 묘사, 마지막은 항상 과거경험.

### 2-3. 설문 vs 돌발 비율
- 콤보 3세트를 **[설문 2 : 돌발 3]** 또는 **[설문 3 : 돌발 2]** 비율로 랜덤 배분
- 롤플레이(11~13)는 주로 돌발 주제
- 어드밴스(14~15)는 설문/돌발 무관

### 2-4. 12문항 모드 (난이도 1~2, 확장)
`자기소개 1 + 콤보 3세트(9) + 롤플레이 2문항` = 12. 어드밴스 없음, 지시문 단순화.

---

## 3. Background Survey 설계

실제 오픽 설문을 반영. 사용자가 선택한 항목이 **설문 기반 출제 풀(pool)** 이 됨.

### Part 1. 신분/직업 (택1)
- 직장인 / 사업가 / 재택근무 / 학생 / 취업 준비 중

### Part 2. 거주 형태 (택1)
- 혼자 삶 / 가족과 함께 / 친구·룸메이트와 / 학교 기숙사

### Part 3. 여가 활동 (복수 선택)
`영화 보기 · 공연 보기 · 콘서트 보기 · 박물관 가기 · 공원 가기 · 캠핑 · 해변 가기 · 스포츠 관람 · SNS/유튜브 시청 · 게임하기`

### Part 4. 취미/관심사 (복수 선택)
`음악 감상 · 악기 연주 · 혼자 노래 부르기 · 독서 · 요리 · 그림 그리기 · 글쓰기 · 반려동물 기르기 · 사진 촬영`

### Part 5. 운동 (복수 선택)
`농구 · 야구 · 축구 · 요가 · 헬스 · 자전거 · 수영 · 조깅/걷기 · 하이킹 · 테니스/배드민턴 · 운동 안 함`

### Part 6. 여행/출장 (복수 선택)
`국내 여행 · 해외 여행 · 국내 출장 · 해외 출장 · 집에서 보내는 휴가`

### 돌발 주제 풀 (설문과 무관하게 앱이 보유)
`은행 · 병원 · 호텔 · 대중교통 · 인터넷/기술 · 재활용 · 날씨/계절 · 명절 · 패션 · 가구 · 전화 통화 · 약속 · 외식/음식점 · 도서관 · 건강 · 카페 · 동네/지역`

> **규칙**: 사용자가 선택한 여가·취미·운동·여행 항목을 합쳐 **최소 8개 이상** 확보(오픽 실제 요건과 유사). 부족하면 다음 단계 진행 막고 안내.

---

## 4. AI 문제 생성 엔진 (핵심 설계)

### 4-1. 설계 원칙 — "형식은 코드가, 내용은 AI가"

> ❌ AI에게 "오픽 시험 만들어줘"라고 통째로 맡기면 순서·유형이 흔들림.
> ✅ **앱이 고정 뼈대(blueprint)를 소유**하고, AI는 각 슬롯의 **질문 텍스트만** 생성.

이렇게 하면 1번=자기소개, 2·3·4=콤보, 11=롤플레이 순서가 **구조적으로 보장**됨.

### 4-2. 생성 파이프라인

```
[1] 사용자 설문 선택 + 난이도
        │
[2] Blueprint 로드 (15슬롯 유형 고정: 위 2-2 표)
        │
[3] Topic Allocator (코드)
     - 콤보1~3에 주제 배정 (설문/돌발 비율 랜덤, 중복 금지)
     - 롤플레이 주제 배정 (돌발 위주)
     - 어드밴스 주제 배정
        │
[4] AI 생성 (세트 단위 호출 — 콤보 3문제를 한 번에)
     - 각 세트: 유형 + 주제 + 제약조건 프롬프트
     - Structured Output(JSON) 강제
        │
[5] Validator (코드)
     - 슬롯 수/유형/필드 검증, 실패 시 재생성
        │
[6] TTS 오디오 생성 + 캐싱
        │
[7] 시험 세션 완성 → 응시 화면
```

> **세트 단위 생성** 이유: 콤보 3문제가 "같은 주제로 묘사→루틴→경험"으로 자연스럽게 이어지도록. 문제별 개별 생성하면 주제 일관성이 깨짐.

### 4-3. 문제 유형별 프롬프트 템플릿

각 세트 호출 시 아래 형태로 시스템/유저 프롬프트 구성. `{topic}` 만 갈아끼움.

**콤보 세트 프롬프트 (예)**
```
너는 ACTFL OPIc 시험 문항 출제자다.
아래 조건으로 콤보 세트 3문항을 영어로 작성하라.

- 주제: {topic}  (예: cafe)
- 난이도: IM3~IH 수준
- 문항 순서와 유형을 반드시 지킬 것:
  1) 묘사(Description): 대상을 자세히 묘사하도록 유도
  2) 습관/루틴(Habit) 또는 비교(Comparison) 중 하나
  3) 과거 경험(Past Experience): 기억에 남는 일화 유도
- 각 문항은 실제 오픽처럼 "구체적으로 말해달라"는 요청을 포함
- 자연스러운 구어체 인터뷰 톤, 각 1~3문장
- 아래 JSON 스키마로만 출력 (설명·마크다운 금지)
```

**롤플레이 프롬프트 (예)**
```
주제 {topic}(예: movie theater booking)로 롤플레이 3문항 작성.
  11) Ask Questions: 상황을 주고 3~4개 질문을 하도록 지시
  12) Solve a Problem: 돌발 문제 발생 → 전화해서 대안 2~3개 제시하도록
  13) Related Experience: 비슷한 실제 경험을 이야기하도록
각 문항에 "I'll give you a situation and act it out" 류의 롤플레이 안내 포함.
```

### 4-4. Structured Output 스키마 (형식 강제의 핵심)

```json
{
  "set_type": "combo | roleplay | advanced | intro",
  "topic": "cafe",
  "source": "survey | surprise",
  "questions": [
    {
      "slot_no": 2,
      "function": "description",
      "text_en": "I'd like to know about a cafe you often visit. Where is it, and what does it look like? Please describe it in as much detail as possible.",
      "text_ko": "자주 가는 카페에 대해 알고 싶어요. 어디에 있고 어떻게 생겼나요? 최대한 자세히 묘사해 주세요.",
      "prep_seconds": 0,
      "answer_seconds": 90
    }
  ]
}
```

- `function` enum으로 유형 고정 → **AI가 유형을 임의로 못 바꿈**
- `slot_no`는 코드가 주입(검증용), AI 값은 무시하거나 대조
- `text_ko`는 학습자 이해용 병기 (실제 시험엔 없지만 연습용으로 유용)

### 4-5. 검증(Validator) 규칙
- 세트별 문항 수 정확?(콤보=3, 롤플=3, 어드=2, 자기소개=1)
- `function` 순서가 blueprint와 일치?
- `text_en`이 비어있거나 한국어 섞이지 않았는지
- 실패 시 해당 세트만 **재생성**(전체 재호출 X → 비용 절감)

### 4-6. 비용·품질 최적화
- **캐싱**: `(function, topic)` 조합으로 생성 결과를 `question_bank`에 저장 → 재사용(단, 같은 유저에겐 최근 N개 제외해 중복 방지)
- **저렴한 모델로 초안 → 검증**, 필요 시에만 상위 모델
- few-shot 예시 2~3개를 프롬프트에 고정해 품질 안정화

---

## 5. 실제 오픽과 유사한 문제 예시 (목표 품질)

**콤보 — 주제: 카페(돌발)**
1. (묘사) "I'd like to know about a cafe you often go to. Where is it located and what does it look like? Describe it in as much detail as possible."
2. (루틴) "What do you usually do at the cafe? Who do you go with and what do you order? Walk me through a typical visit."
3. (경험) "Tell me about a memorable experience you had at a cafe. When was it, who were you with, and what made it memorable?"

**롤플레이 — 주제: 영화관 예매(돌발)**
11. (질문) "I'll give you a situation and act it out. You want to watch a movie this weekend. Call the theater and ask three or four questions to get the information you need."
12. (문제해결) "There's a problem. The movie you booked has been canceled. Call your friend, explain the situation, and suggest two or three alternatives."
13. (경험) "That's the end of the situation. Have you ever had a plan canceled unexpectedly? Tell me what happened and how you handled it."

**어드밴스 — 주제: 기술(설문/돌발)**
14. (비교) "How has technology changed the way people communicate compared to the past? Describe the differences in detail."
15. (이슈) "Some people worry about the downsides of smartphones. What are the main concerns, and what do you think can be done about them?"

---

## 6. 사용자 플로우

```
랜딩 → [배경설문 작성] → [난이도(Self-Assessment) 선택]
     → "시험 생성 중…" (AI 파이프라인)
     → [모의고사 응시 화면]
          · 문제 오디오 자동 재생(TTS) + (옵션)텍스트
          · 마이크 녹음(MediaRecorder) / 준비·답변 타이머
          · 다음 문제 이동 (되돌아가기 불가 = 실전 재현)
     → [결과 화면]
          · 15문항 스크립트 + 내 녹음 재생
          · (확장)AI 피드백/예상 등급
     → [세션 저장 / 다시 풀기(새 문제)]
```

---

## 7. 화면 구성

| 화면 | 핵심 요소 |
|------|------|
| 랜딩 | 서비스 소개, "모의고사 시작" CTA |
| 배경설문 | 카테고리별 다중 선택 UI, 선택 개수 검증 |
| 난이도 선택 | 1~6단계 설명 카드, 샘플 답변 |
| 로딩 | 생성 진행 상태(세트별 스텝) |
| 응시 | 문항 번호/유형 배지, 오디오 플레이어, 녹음 버튼, 타이머, 진행바 |
| 결과 | 문항별 스크립트(영/한), 내 답변 오디오, (확장)피드백 |
| 히스토리 | 지난 세션 목록, 취약 유형 통계 |

> 실전 몰입을 위해 응시 화면은 **오픽 시험 UI 톤(미니멀·집중형)** 으로. 문항 유형 배지는 학습 모드에서만 노출, 실전 모드에선 숨김 옵션.

---

## 8. 기능 명세

### MVP (Phase 1)
- [ ] 배경설문 → 난이도 선택
- [ ] AI 15문항 세트 생성 (형식 강제 + 검증)
- [ ] 문항 TTS 재생 (브라우저 SpeechSynthesis)
- [ ] 마이크 녹음 + 타이머
- [ ] 결과 화면(스크립트 + 내 녹음 재생, 로컬 저장)

### Phase 2
- [ ] 계정/로그인, 세션 히스토리
- [ ] `question_bank` 캐싱, 클라우드 TTS(자연스러운 음성)
- [ ] 12문항 모드, 유형별 집중 연습 모드

### Phase 3
- [ ] STT(음성→텍스트) + AI 피드백/루브릭 채점(예상 등급, 문법/어휘/유창성)
- [ ] 취약 유형 분석 대시보드
- [ ] 돌발 주제 집중 훈련, 시험장 백색소음 모드

---

## 9. 기술 스택 & 아키텍처 (프론트 중심 제안)

| 레이어 | 선택지 | 비고 |
|------|------|------|
| 모노레포 | Turborepo + pnpm workspaces | web / api / shared(스키마·blueprint) 분리 |
| 프론트 | Next.js(App Router) + TS | Server Actions로 생성 로직 서버 처리 |
| 스타일 | Tailwind + shadcn/ui | |
| AI | Claude Messages API (structured output/tool use) | 유형 스키마 강제에 적합 |
| TTS | MVP: Web SpeechSynthesis / 확장: ElevenLabs·Google Cloud TTS | 자연스러운 여성 인터뷰어 음성 |
| STT(확장) | Whisper API | 피드백용 |
| 녹음 | MediaRecorder API | |
| DB | Postgres(Supabase) | 설문·세션·문제 캐시 |
| Auth | Supabase Auth / NextAuth | |

> `shared` 패키지에 **blueprint 정의 + Zod 스키마 + validator**를 두면, 프론트·API가 같은 형식 규칙을 공유 → 형식 일관성 보장. 모노레포 구조와 잘 맞음.

---

## 10. 데이터 모델 (초안)

```
users(id, email, created_at)

survey_responses(id, user_id, selections_jsonb, created_at)
  # selections_jsonb: {status, residence, leisure[], hobby[], sport[], travel[]}

test_sessions(id, user_id, difficulty, question_count, blueprint_version, created_at)

questions(id, session_id, slot_no, set_type, function,
          topic, source, text_en, text_ko, audio_url,
          prep_seconds, answer_seconds)

recordings(id, question_id, audio_url, transcript, score_jsonb, created_at)

question_bank(id, function, topic, difficulty, text_en, text_ko, usage_count)
  # (function, topic) 캐시 재사용 풀
```

---

## 11. 개발 로드맵

| 단계 | 산출물 | 기간(러프) |
|------|------|------|
| Phase 0 | blueprint 확정, 프롬프트 튜닝, 스키마 정의 | 1주 |
| Phase 1 (MVP) | 설문→생성→응시→결과 end-to-end | 2~3주 |
| Phase 2 | 계정·히스토리·캐싱·클라우드 TTS | 2주 |
| Phase 3 | STT + AI 피드백·채점, 분석 대시보드 | 3주+ |

---

## 12. 리스크 & 고려사항

| 리스크 | 대응 |
|------|------|
| **"OPIc"은 등록상표** | 서비스명에 직접 사용 지양. "오픽 유형 대비 모의고사" 식 표현, 공식 제휴 아님 명시 |
| 기출 복제 시 저작권 | 실제 기출 저장·복제 금지, **AI 유사 유형 생성**으로만 |
| LLM 형식 이탈 | app-owned blueprint + enum 스키마 + validator 재생성 |
| 생성 비용 | 세트 단위 생성 + `question_bank` 캐싱 + 저가 모델 초안 |
| 품질 편차 | few-shot 고정, 난이도별 프롬프트 분리, 사람 검수 샘플링 |
| TTS 부자연 | MVP 브라우저 TTS → 확장 시 클라우드 TTS로 교체 |
| 개인정보(음성) | 녹음 로컬 우선, 서버 저장 시 동의·암호화·보존기간 정책 |

---

## 13. 핵심 요약

1. **형식 보장의 열쇠**: 시험 뼈대(15슬롯 유형·순서)는 **코드가 소유**, AI는 각 슬롯 텍스트만 채움.
2. **콤보 3단 패턴 고정**: `묘사 → 습관/비교 → 과거경험`.
3. **설문 기반 랜덤**: 사용자 선택 풀 + 돌발 풀을 [설문:돌발] 비율로 배분, 중복 방지.
4. **Structured Output + Validator**로 유형 이탈 차단, 세트 단위 생성으로 주제 일관성 확보.
5. **실전 유사성**: few-shot 예시로 실제 오픽 톤(구체 요청·롤플레이 상황·비교/이슈)을 재현.
