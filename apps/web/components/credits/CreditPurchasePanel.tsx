"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANONYMOUS, loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { CREDIT_PACKAGES, pricePerCreditKrw, type CreditPackageId } from "@testalk/shared";
import { purchaseCredits } from "@/app/actions/purchaseCredits";

interface CreditPurchasePanelProps {
  initialBalance: number;
  /** 서버가 테스트 지급(stub)을 허용하는 환경인지 — 안내 문구 표시용일 뿐, 실제 판단은 서버가 한다. */
  testMode: boolean;
  /** 토스 success/fail 콜백이 붙여준 ?payment= 결과 (서버 승인 처리 결과). */
  paymentResult?: string;
}

type Message = { kind: "success" | "info" | "error"; text: string };

const krw = new Intl.NumberFormat("ko-KR");

/** 서버 콜백(/api/payments/toss/*)이 리다이렉트로 넘긴 결과 코드 → 안내 문구. */
function messageForPaymentResult(result: string | undefined): Message | null {
  switch (result) {
    case undefined:
      return null;
    case "paid":
      return { kind: "success", text: "결제가 완료되어 크레딧이 충전됐어요." };
    case "already_paid":
      return { kind: "info", text: "이미 처리된 결제예요. 크레딧은 한 번만 충전돼요." };
    case "canceled":
      return { kind: "info", text: "결제를 취소했어요." };
    case "amount_mismatch":
      return { kind: "error", text: "결제 금액이 일치하지 않아 충전되지 않았어요. 문제가 계속되면 문의해주세요." };
    default:
      return { kind: "error", text: "결제에 실패했어요. 다시 시도해주세요." };
  }
}

/**
 * 패키지 선택 → 구매 확인 → purchaseCredits(packageId)로 서버 주문 생성.
 * 토스면 그 주문으로 결제창을 띄우고, 승인/지급은 서버 successUrl 콜백이 처리한다.
 * 카드 정보는 여기서 받지 않는다 — 토스 결제창이 담당한다.
 */
export function CreditPurchasePanel({ initialBalance, testMode, paymentResult }: CreditPurchasePanelProps) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [selectedId, setSelectedId] = useState<CreditPackageId | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<Message | null>(() => messageForPaymentResult(paymentResult));

  const selected = CREDIT_PACKAGES.find((pkg) => pkg.id === selectedId) ?? null;

  async function handleConfirm() {
    if (!selected) return;
    setStatus("loading");
    setMessage(null);
    try {
      const result = await purchaseCredits(selected.id);
      switch (result.status) {
        case "checkout": {
          // 서버가 만든 주문(금액/주문번호)으로 토스 결제창을 띄운다. 성공/실패 시 서버 콜백으로 이동한다.
          const tossPayments = await loadTossPayments(result.clientKey);
          const payment = tossPayments.payment({ customerKey: ANONYMOUS });
          await payment.requestPayment({
            method: "CARD",
            amount: { currency: "KRW", value: result.amountKrw },
            orderId: result.orderId,
            orderName: result.orderName,
            successUrl: `${window.location.origin}/api/payments/toss/success`,
            failUrl: `${window.location.origin}/api/payments/toss/fail`,
          });
          return; // 리다이렉트로 페이지를 떠난다.
        }
        case "already_paid":
          setMessage(messageForPaymentResult("already_paid"));
          break;
        case "amount_mismatch":
          setMessage(messageForPaymentResult("amount_mismatch"));
          break;
        case "ok":
          setBalance(result.creditBalance);
          setMessage({ kind: "success", text: `크레딧 ${result.credits}개가 충전됐어요.` });
          setSelectedId(null);
          router.refresh(); // 헤더 잔액 뱃지(서버 컴포넌트)도 갱신한다.
          break;
        case "payment_unavailable":
          setMessage({ kind: "info", text: "결제 준비 중입니다. 조금만 기다려주세요." });
          break;
        case "login_required":
          setMessage({ kind: "error", text: "로그인이 필요합니다." });
          break;
        case "invalid_package":
          setMessage({ kind: "error", text: "알 수 없는 상품이에요. 새로고침 후 다시 시도해주세요." });
          break;
        case "payment_failed":
          setMessage({ kind: "error", text: "결제에 실패했어요. 다시 시도해주세요." });
          break;
      }
    } catch (err) {
      // 결제창을 닫으면 SDK가 USER_CANCEL 등 code를 가진 에러로 reject한다. 주문은 pending으로 남고 지급은 없다.
      const code = (err as { code?: unknown })?.code;
      setMessage(
        typeof code === "string" && code.includes("CANCEL")
          ? messageForPaymentResult("canceled")
          : { kind: "error", text: "구매 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." },
      );
    } finally {
      setStatus("idle");
      setConfirming(false);
    }
  }

  return (
    <div>
      <div className="rounded-2xl border-2 border-emerald-100 bg-white p-5">
        <p className="text-xs font-semibold text-slate-400">보유 크레딧</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-800">{balance}개</p>
        <p className="mt-1 text-xs text-slate-500">1크레딧 = 시험 1회 채점 응시 (문제 생성 + 15문항 AI 피드백)</p>
      </div>

      {testMode && (
        <p className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
          테스트 모드 — 실제 결제 없이 크레딧이 지급돼요.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {CREDIT_PACKAGES.map((pkg) => {
          const isSelected = pkg.id === selectedId;
          return (
            <li key={pkg.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(pkg.id);
                  setConfirming(false);
                  setMessage(null);
                }}
                disabled={status === "loading"}
                aria-pressed={isSelected}
                className={`flex w-full items-center justify-between rounded-2xl border-2 bg-white p-5 text-left transition-colors ${
                  isSelected ? "border-emerald-500 bg-emerald-50/50" : "border-slate-100 hover:border-emerald-200"
                }`}
              >
                <div>
                  <p className="text-lg font-bold text-slate-800">{pkg.credits}회</p>
                  <p className="mt-0.5 text-xs text-slate-500">회당 {krw.format(pricePerCreditKrw(pkg))}원</p>
                </div>
                <p className="text-base font-bold text-emerald-700">{krw.format(pkg.priceKrw)}원</p>
              </button>
            </li>
          );
        })}
      </ul>

      {message && (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-sm font-medium ${
            message.kind === "success"
              ? "bg-emerald-50 text-emerald-700"
              : message.kind === "info"
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      {confirming && selected ? (
        <div className="mt-6 rounded-2xl border-2 border-emerald-200 bg-white p-5">
          <p className="text-sm font-bold text-slate-800">
            크레딧 {selected.credits}개 · {krw.format(selected.priceKrw)}원을 구매할까요?
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={status === "loading"}
              className="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {status === "loading" ? "처리 중..." : "확인"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={status === "loading"}
              className="rounded-full border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-500 hover:border-slate-300"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!selected || status === "loading"}
          className="mt-6 w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          구매하기
        </button>
      )}
    </div>
  );
}
