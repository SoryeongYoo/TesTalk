/**
 * Background Survey(배경설문) 항목 정의.
 * 실제 오픽(OPIc) 배경설문 문항을 그대로 반영한다 (참고: docs/PLAN.md 3. "Background Survey 설계").
 *
 * Part 1(직업)·Part 2(학생 여부, "아니요" 선택 시 수강 이력 후속 질문)·Part 3(거주 형태)는
 * 단일 선택(single), Part 4~7(여가/취미/운동/휴가·출장)은 복수 선택(multi)이다.
 * 각 파트는 `minSelect`로 최소 선택 개수를 스스로 선언하고, 화면은 이 값을 읽어서
 * "다음" 버튼 활성화 여부를 결정한다 — 화면에 최소 선택 개수를 하드코딩하지 않는다.
 *
 * 여가·취미·운동·휴가/출장에서 고른 항목의 label을 합쳐 `allocateTopics`의
 * `surveyTopics` 인자로 넘긴다 (`SURVEY_TOPIC_POOL_CATEGORY_IDS` 참고).
 *
 * Part 4~7(선택 개수 합계 12개 고정, 파트별 최소 개수 등) 선택 검증 규칙은 이 파일이 아니라
 * 순수 함수로 분리된 `surveyValidator.ts`가 소유한다 — 화면(apps/web)은 데이터(이 파일)와
 * 검증 로직(surveyValidator.ts)을 조합만 한다.
 *
 * Part 6(운동)의 "운동을 전혀 하지 않음"도 다른 옵션과 동일한 일반 옵션이다 — 배타 선택이나
 * 최소 개수 예외 같은 특수 처리를 두지 않고, part4~7의 다른 파트와 완전히 동일하게 다룬다.
 */

/** 설문 선택지 하나. 화면에는 label을 노출하고, id는 선택 상태 추적용 식별자로 쓴다. */
export interface SurveyOption {
  id: string;
  label: string;
}

/** 설문 파트가 단일 선택인지 복수 선택인지. */
export type SurveySelectionType = "single" | "multi";

/** 후속 질문 파트 정의(예: part2 "학생 여부 = 아니요" → 수강 이력). 중첩 후속 질문은 없다. */
export interface SurveyFollowUpCategory {
  id: string;
  title: string;
  selectionType: SurveySelectionType;
  /** 이 파트에서 최소 선택해야 하는 개수. */
  minSelect: number;
  options: readonly SurveyOption[];
}

/** 특정 옵션이 선택된 경우에만 노출되는 후속 질문. */
export interface SurveyFollowUp {
  /** 이 옵션 id가 선택된 경우에만 후속 질문을 노출한다. */
  triggerOptionId: string;
  category: SurveyFollowUpCategory;
}

/** 설문 파트(최상위) 정의. */
export interface SurveyCategory extends SurveyFollowUpCategory {
  part: number;
  /** 특정 옵션 선택 시에만 노출되는 후속 질문 (현재 part2에만 존재). */
  followUp?: SurveyFollowUp;
}

/** Background Survey 7개 파트. 순서는 실제 오픽 설문 순서를 따른다. */
export const SURVEY_CATEGORIES: readonly SurveyCategory[] = [
  {
    part: 1,
    id: "occupation",
    title: "직업",
    selectionType: "single",
    minSelect: 1,
    options: [
      { id: "business_company", label: "사업/회사" },
      { id: "remote_work_business", label: "재택근무/재택사업" },
      { id: "teacher_educator", label: "교사/교육자" },
      { id: "military_service", label: "군 복무" },
      { id: "no_work_experience", label: "일 경험 없음" },
    ],
  },
  {
    part: 2,
    id: "student_status",
    title: "학생 여부",
    selectionType: "single",
    minSelect: 1,
    options: [
      { id: "yes", label: "예" },
      { id: "no", label: "아니요" },
    ],
    followUp: {
      // "아니요"를 선택한 경우에만 수강 이력을 물어본다.
      triggerOptionId: "no",
      category: {
        id: "enrollment_history",
        title: "수강 이력",
        selectionType: "single",
        minSelect: 1,
        options: [
          { id: "degree_program_courses", label: "학위 과정 수업" },
          { id: "professional_development_courses", label: "전문 기술 향상 평생학습" },
          { id: "language_courses", label: "어학 수업" },
          { id: "more_than_5_years_since_enrollment", label: "수업 등록 후 5년 이상 지남" },
        ],
      },
    },
  },
  {
    part: 3,
    id: "residence",
    title: "거주 형태",
    selectionType: "single",
    minSelect: 1,
    options: [
      { id: "living_alone", label: "개인 주택/아파트에 홀로 거주" },
      { id: "with_roommate", label: "친구/룸메이트와 거주" },
      { id: "with_family", label: "가족과 거주" },
      { id: "dormitory", label: "학교 기숙사" },
      { id: "military_quarters", label: "군대 막사/군 시설" },
    ],
  },
  {
    part: 4,
    id: "leisure",
    title: "여가 활동",
    selectionType: "multi",
    minSelect: 2,
    options: [
      { id: "movies", label: "영화 보기" },
      { id: "performances", label: "공연 보기" },
      { id: "concerts", label: "콘서트 보기" },
      { id: "museums", label: "박물관 가기" },
      { id: "parks", label: "공원 가기" },
      { id: "beach", label: "해변 가기" },
      { id: "camping", label: "캠핑하기" },
      { id: "watching_sports", label: "스포츠 관람" },
      { id: "shopping", label: "쇼핑하기" },
      { id: "watching_tv", label: "TV 보기" },
      { id: "watching_reality_shows", label: "리얼리티쇼 시청" },
      { id: "watching_cooking_shows", label: "요리 프로그램 시청" },
      { id: "watching_news", label: "뉴스 보기" },
      { id: "gaming", label: "게임하기" },
      { id: "posting_on_social_media", label: "SNS에 글 올리기" },
      { id: "texting_friends", label: "친구들과 문자 대화" },
      { id: "going_to_bars", label: "술집/바 가기" },
      { id: "going_to_cafes", label: "카페/커피전문점 가기" },
      { id: "playing_billiards", label: "당구 치기" },
      { id: "going_to_clubs", label: "클럽/나이트클럽 가기" },
      { id: "volunteering", label: "자원봉사" },
      { id: "driving", label: "드라이브" },
      { id: "home_improvement", label: "주거 개선" },
      { id: "job_hunting", label: "구직 활동" },
      { id: "taking_exam_prep_courses", label: "시험 대비 과정 수강" },
      { id: "going_to_spa_massage", label: "스파/마사지샵 가기" },
      { id: "playing_chess", label: "체스하기" },
    ],
  },
  {
    part: 5,
    id: "hobbies",
    title: "취미/관심사",
    selectionType: "multi",
    minSelect: 2,
    options: [
      { id: "reading_to_children", label: "아이에게 책 읽어주기" },
      { id: "writing", label: "글쓰기" },
      { id: "reading", label: "독서" },
      { id: "photography", label: "사진 촬영" },
      { id: "listening_to_music", label: "음악 감상" },
      { id: "drawing", label: "그림 그리기" },
      { id: "stock_investing", label: "주식 투자" },
      { id: "singing_alone_or_in_choir", label: "혼자 노래 부르기/합창" },
      { id: "playing_instrument", label: "악기 연주" },
      { id: "cooking", label: "요리하기" },
      { id: "reading_newspaper", label: "신문 읽기" },
      { id: "reading_travel_magazines_blogs", label: "여행 잡지/블로그 읽기" },
      { id: "dancing", label: "춤추기" },
      { id: "pets", label: "애완동물 기르기" },
    ],
  },
  {
    part: 6,
    id: "exercise",
    title: "운동",
    selectionType: "multi",
    minSelect: 2,
    options: [
      { id: "basketball", label: "농구" },
      { id: "hockey", label: "하키" },
      { id: "tennis", label: "테니스" },
      { id: "cycling", label: "자전거" },
      { id: "walking", label: "걷기" },
      { id: "gym", label: "헬스" },
      { id: "baseball_softball", label: "야구/소프트볼" },
      { id: "cricket", label: "크리켓" },
      { id: "badminton", label: "배드민턴" },
      { id: "skiing_snowboarding", label: "스키/스노보드" },
      { id: "yoga", label: "요가" },
      { id: "taekwondo", label: "태권도" },
      { id: "soccer", label: "축구" },
      { id: "golf", label: "골프" },
      { id: "table_tennis", label: "탁구" },
      { id: "ice_skating", label: "아이스스케이트" },
      { id: "hiking_trekking", label: "하이킹/트레킹" },
      { id: "taking_fitness_classes", label: "운동 수업 수강" },
      { id: "american_football", label: "미식축구" },
      { id: "volleyball", label: "배구" },
      { id: "swimming", label: "수영" },
      { id: "jogging", label: "조깅" },
      { id: "fishing", label: "낚시" },
      { id: "no_exercise", label: "운동을 전혀 하지 않음" },
    ],
  },
  {
    part: 7,
    id: "travel",
    title: "휴가/출장",
    selectionType: "multi",
    minSelect: 2,
    options: [
      { id: "domestic_business_trip", label: "국내 출장" },
      { id: "international_business_trip", label: "해외 출장" },
      { id: "staycation", label: "집에서 보내는 휴가" },
      { id: "domestic_travel", label: "국내 여행" },
      { id: "international_travel", label: "해외 여행" },
    ],
  },
] as const;

/**
 * 여가·취미·운동·휴가/출장처럼 topic pool(`allocateTopics`의 surveyTopics)에
 * 합산되는 파트의 id 목록. 직업/학생 여부/거주 형태는 시험 topic이 아니라
 * 시험 형식 결정용 정보이므로 제외한다.
 */
export const SURVEY_TOPIC_POOL_CATEGORY_IDS = [
  "leisure",
  "hobbies",
  "exercise",
  "travel",
] as const;
