import Link from "next/link";
import { OPIC_QUESTION_COUNT } from "@testalk/shared";
import { auth, signIn } from "@/auth";
import { TermsConsentNotice } from "@/components/legal/TermsConsentNotice";
import { DEFAULT_SIGNUP_CREDITS } from "@/lib/server/credits";
import { getDailyFreeGenerations } from "@/lib/server/generationLimit";

// 고급스러운 SVG 아이콘 정의
const VALUE_PROPS = [
  {
    icon: (
      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "실전 형식 100% 준수",
    body: `실제 오픽과 같은 ${OPIC_QUESTION_COUNT}문항 순서·유형 그대로. 콤보·롤플레이 구성까지 똑같이 맞춰요.`,
  },
  {
    icon: (
      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "매번 새 문제",
    body: "설문에서 고른 주제로 AI가 매번 새로운 문제를 만들어요. 외운 답변은 통하지 않아요.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "AI 피드백",
    body: "녹음한 답변을 AI가 분석해 문항별로 잘한 점과 고칠 점을 알려줘요.",
  },
] as const;

const STEPS = [
  { title: "설문", body: "직업·거주·취미 등 나에게 맞는 주제를 골라요." },
  { title: "난이도 선택", body: "내 말하기 수준에 가까운 난이도를 골라요." },
  { title: "AI 문제 생성", body: "설문 주제로 실전 형식의 새 문제 세트가 만들어져요." },
  { title: "응시 (녹음)", body: "질문을 듣고 실제 시험처럼 말로 답변을 녹음해요." },
  { title: "AI 피드백", body: "문항별 답변을 AI가 평가하고 개선점을 알려줘요." },
] as const;

export default async function Home() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);

  return (
    <main className="relative min-h-screen overflow-hidden break-keep bg-slate-950 font-sans text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
      {/* 배경 오로라/빛 효과 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[40rem] w-[40rem] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-12 h-[25rem] w-[25rem] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      {/* 히어로 섹션 */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-28">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI 오픽(OPIc) 실전 모의고사
        </span>

        <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl sm:leading-[1.15]">
          AI가 실제 오픽 형식으로
          <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            매번 새 문제
          </span>
          를 내주는 모의고사
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
          설문만 마치면 나에게 최적화된 <strong className="font-semibold text-slate-200">{OPIC_QUESTION_COUNT}문항</strong>이 즉시 생성됩니다. 실전 녹음부터 문항별 정밀 AI 피드백까지 경험해 보세요.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/survey"
            className="group relative inline-flex w-full max-w-xs items-center justify-center overflow-hidden rounded-full bg-emerald-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:bg-emerald-400 hover:shadow-emerald-500/40 active:scale-95"
          >
            <span>시작하기</span>
            <svg className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <p className="text-xs text-slate-500">설문 → 난이도 선택 → 바로 모의고사 시작</p>
        </div>

        {!isLoggedIn && (
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-left backdrop-blur-md sm:flex-row sm:gap-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-400">
              🔓
            </div>
            <div className="flex-1">
              <p className="text-xs leading-relaxed text-amber-200/90 sm:text-sm">
                설문은 <strong className="font-semibold text-amber-300">로그인 없이 체험</strong>할 수 있고, 연습 시험 생성과 말하기 연습은 로그인 후 하루 {getDailyFreeGenerations()}회까지 무료입니다. 15문항 <strong className="font-semibold text-amber-300">AI 상세 피드백</strong>은 크레딧 1개로 시험 1회를 채점 응시할 때 받을 수 있습니다. (신규 가입 시 <span className="underline underline-offset-2">{DEFAULT_SIGNUP_CREDITS} 크레딧</span> 지급)
              </p>
              <TermsConsentNotice tone="dark" className="mt-2" />
            </div>
            <form
              action={async () => {
                "use server";
                await signIn("cognito");
              }}
              className="w-full sm:w-auto"
            >
              <button
                type="submit"
                className="w-full whitespace-nowrap rounded-full border border-amber-400/40 bg-amber-400/10 px-5 py-2.5 text-xs font-bold text-amber-300 transition-all hover:bg-amber-400/20 hover:text-amber-200 active:scale-95 sm:w-auto"
              >
                로그인하기
              </button>
            </form>
          </div>
        )}
      </section>

      {/* 핵심 가치 */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {VALUE_PROPS.map((item) => (
            <div
              key={item.title}
              className="group relative rounded-3xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-emerald-500/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                {item.icon}
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-100">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 진행 방식 */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">어떻게 진행되나요?</h2>
          <p className="mt-2 text-sm text-slate-400">5단계로 손쉽게 경험하는 실전 모의고사 프로세스</p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative flex items-start gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md transition-colors hover:border-slate-700 lg:flex-col lg:items-center lg:gap-3 lg:text-center"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-extrabold text-slate-950 shadow-md shadow-emerald-500/20">
                {index + 1}
              </span>
              <div>
                <h3 className="font-bold text-slate-200">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 text-center">
          <Link
            href="/survey"
            className="inline-flex items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-8 py-3.5 text-sm font-bold text-emerald-400 transition-all duration-200 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95"
          >
            지금 바로 시작하기
          </Link>
        </div>
      </section>
    </main>
  );
}