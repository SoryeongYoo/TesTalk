# 배포 트러블슈팅 기록 (AWS Amplify)

> pnpm 모노레포(`apps/web`, `packages/shared`) 구조의 Next.js 앱을 AWS Amplify Hosting(SSR compute)에
> 배포하며 겪은 문제와 해결 과정 기록. 같은 함정에 다시 빠지지 않기 위한 참고 문서이며,
> 실험적 시도가 아니라 **최종적으로 채택된 설정의 이유**를 남기는 데 목적이 있다.

---

## ① next.config를 `.ts`로 못 씀 (배포 전, 로컬 빌드 단계)

- **증상**: `pnpm dev` / 프로덕션 빌드가 `next.config.ts` 때문에 실패
- **원인**: 당시 사용 중인 Next.js 버전이 `.ts` config를 제대로 지원하지 않음
- **해결**: `next.config.mjs`로 전환
- **교훈**: 배포 설정을 만지기 전에 로컬 프로덕션 빌드(`next build`)부터 통과시켜야 원인 범위를 좁힐 수 있다.

## ② 브랜치가 main에 반영 안 됨 (제일 헷갈렸던 근본 원인)

- **증상**: `amplify.yml`을 고쳤는데 빌드에 계속 옛날 설정(`cd ../..`)이 적용됨
- **원인**: 작업이 `feat/ai-generate-verify-script` 브랜치에 있었는데, Amplify는 `main`을 배포함.
  `main`에는 최신 수정이 없었음
- **해결**: feat 브랜치를 main에 merge + push
- **교훈**: **"배포 = main에 반영"**. Amplify가 보는 브랜치에 실제로 커밋이 올라가 있어야 한다.
  이 사실을 놓쳐서 여러 번 헛돌았다 — 배포 설정을 고칠 때마다 `git diff origin/main`으로
  main과의 차이를 먼저 확인할 것.

## ③ 빌드 경로 문제 — cd 누적 (build 단계 실패)

- **증상**: `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` / `No package.json found`
- **원인**: Amplify가 phase(`preBuild`→`build`)마다 이전 phase가 끝난 cwd를 그대로 이어받는데,
  `cd ../..`가 phase마다 다시 적용되면서 두 번 누적돼 repo 밖으로 나감.
  `cd $CODEBUILD_SRC_DIR`로 바꿔봐도 이 값 자체가 기대한 경로와 한 단계 어긋나 있어서 실패
- **해결**: 상대경로로 추측하는 대신, 현재 cwd에서 `pnpm-workspace.yaml`이 있는 지점까지
  상위로 탐색해 repo 루트를 **동적으로** 찾는 방식으로 전환 (`amplify.yml`의
  `ROOT_DIR=$(pwd); while [ ! -f "$ROOT_DIR/pnpm-workspace.yaml" ] ...`)
- **교훈**: 모노레포 빌드는 "어디서 명령을 실행하느냐(cwd)"가 핵심이다. phase 간 cwd 인계
  방식이 문서화되어 있지 않으므로, 상대경로(`cd ../..`) 같은 고정 가정은 불안정하다 —
  워크스페이스 마커를 찾아 절대경로로 수렴시키는 편이 안전하다.

## ④ pnpm 심볼릭 링크 — 런타임에 next 없음 (deploy 단계 실패, 최종 관문)

- **증상**: build는 성공하는데 deploy에서
  `CustomerError: The 'node_modules' folder is missing the 'next' dependency`
- **원인**: pnpm은 기본적으로 실제 파일을 중앙 저장소(`node_modules/.pnpm`)에 두고
  각 워크스페이스 패키지(`apps/web/node_modules`)에는 심볼릭 링크(symlink/junction)만 둔다.
  Amplify가 `appRoot`(`apps/web`) 기준으로 패키징할 때 이 심볼릭 링크가 가리키는 실제 파일이
  함께 따라가지 못해 `next` 런타임이 빠짐.
- **시도했지만 부족했던 것**: `next.config.mjs`에 `output: "standalone"`을 켜서 Next의 파일
  추적(file tracing) 단계가 필요한 의존성만 실제 파일로 모으게 했지만, 그것만으로는
  재발함 — Amplify의 deploy 단계 검사는 표준 `next build` 산출물(`apps/web/node_modules`)
  기준으로 동작하는 것으로 보이며 `.next/standalone`을 항상 활용하지는 않는 것으로 보인다.
- **최종 해결** (두 가지를 함께 적용):
  1. 루트 `.npmrc`에 `node-linker=hoisted` 추가 → pnpm이 심볼릭 링크 대신 실제 파일을
     `node_modules`에 직접 배치 (npm/yarn classic 방식). AWS Amplify 모노레포 FAQ가
     pnpm 앱에 공식적으로 권장하는 설정이다.
  2. 루트 `package.json`에 `next`를 **직접 의존성**으로 추가 (`apps/web/package.json`의
     의존성은 그대로 유지). hoisted 레이어링만으로는 `next`가 여전히 `apps/web`의
     의존성 그래프를 통해서만 도달 가능한 상태였고, 이 경우도 배포 실패가 재현된다는
     보고가 다수 있었다 (`aws-amplify/amplify-hosting#4036`). `next`를 워크스페이스
     루트의 직접 의존성으로 못박아야 Amplify의 deploy 검사가 이를 인식한다.
- **교훈**: 모노레포 + pnpm 배포의 알려진 함정이다. 로컬 개발/빌드에서는 심볼릭 링크가
  정상 동작하므로 전혀 드러나지 않다가, "옮기는 과정(배포 패키징)"에서만 드러난다.
  `output: "standalone"`은 배포 아티팩트 크기를 줄이는 데는 여전히 유효하므로 유지했다 —
  다만 이것 하나로 심볼릭 링크 문제까지 해결된다고 가정하지 말 것.
- **재발 시 다음 후보**: 위 두 가지로도 재발하면, 커뮤니티에서 최근까지 확인된 마지막
  workaround는 `preBuild`에서 `pnpm --filter web remove next && pnpm add next -w`를
  실행해 `next`를 아예 루트 패키지로 이전하는 것이다 (참고:
  `aws-amplify/amplify-hosting#4036`의 최신 댓글들).

---

## 최종 설정 요약

- `amplify.yml`: `preBuild`/`build` 커맨드는 워크스페이스 마커(`pnpm-workspace.yaml`) 탐색으로
  repo 루트를 찾아 그 위치에서 `pnpm install --frozen-lockfile` / `pnpm turbo run build --filter=web`
  실행. `artifacts.baseDirectory`는 `.next` 유지(`.next/standalone`으로 바꾸지 않음 — public/static
  누락됨).
- `apps/web/next.config.mjs`: `output: "standalone"` — 배포 아티팩트에서 불필요한 의존성 제외.
- `.npmrc`: `node-linker=hoisted` — pnpm 심볼릭 링크 대신 실제 파일 배치.
- 루트 `package.json`: `next`를 직접 의존성으로 포함 — Amplify deploy 검사가 인식 가능한
  위치에 고정.

새 배포 이슈가 생기면 이 문서에 위와 같은 형식(증상 → 원인 → 해결 → 교훈)으로 이어서
기록한다.
