# Alien Index 프로덕션 서비스 설계안

> 문서 버전: 1.0
> 기준일: 2026-07-22
> 대상: 현재 빠른 감별 MVP → 실제 공개 서비스

## 1. 결정 요약

Alien Index는 진단 서비스가 아니라 사용자의 사고·꿈·감각·선택을 유쾌한 외계인 정체성으로 변환하는 엔터테인먼트 서비스다. 제품의 핵심 약속은 다음과 같다.

> 질문과 짧은 게임으로 나의 성향을 발견하고, 선택한 사진의 시각적 분위기를 더해 세상에 하나뿐인 외계인 신분증을 얻는다.

운영 버전의 권장 구조는 다음과 같다.

- 프런트엔드: Next.js App Router 모바일 웹앱
- 정적 앱 배포: Firebase Hosting
- 사용자 식별: Firebase Anonymous Authentication, 이후 선택적으로 계정 연결
- API: 2세대 Firebase Callable Functions
- 비동기 AI 작업: Cloud Tasks + Firebase Task Queue Functions
- 데이터: Cloud Firestore
- 비공개 사진 및 생성 이미지: Cloud Storage for Firebase
- 악용 방지: Firebase App Check + reCAPTCHA Enterprise, 서버 측 사용량 제한
- 비밀값: Google Cloud Secret Manager
- AI: 서버에서만 OpenAI Responses/Image API 호출
- 운영 설정: Firestore의 관리자 전용 모델·비용·프롬프트 설정

현재 앱은 전부 클라이언트에서 동작하므로 1차 출시에는 정적 Hosting이 가장 단순하다. 동적 OG 공유 페이지나 SSR이 필요해지면 `/r/**`만 Cloud Run의 작은 공유 렌더러로 라우팅한다. Firebase App Hosting은 배포 시점의 Next.js 공식 지원 범위를 다시 확인하고 도입한다.

## 2. Apple 디자인 감사

검토 기준은 Apple HIG의 hierarchy, harmony, consistency, accessibility, typography, gestures 원칙이다. 특히 iOS 기본 컨트롤 목표 크기 44×44pt, 작은 텍스트 대비, 색상 외 상태 표시, 제스처 대체 수단을 기준으로 삼았다.

### 2.1 잘 적용된 부분

| 항목 | 평가 | 근거 |
|---|---|---|
| 시각적 위계 | 좋음 | 화면마다 하나의 큰 질문 또는 결과만 중심에 놓고 보조 정보는 작게 분리했다. |
| 재질과 깊이 | 좋음 | 밝은 테스트 화면의 반투명 카드, 결과 화면의 제한된 글로우가 콘텐츠보다 앞서지 않는다. |
| 플랫폼 조화 | 좋음 | 시스템 폰트, 큰 제목, 둥근 컨테이너, safe-area 패딩을 사용한다. |
| 직접성 | 좋음 | 선택 즉시 상태가 변하고, 카드 전체가 터치 대상이며, 버튼은 눌림 피드백을 제공한다. |
| 모션 | 좋음 | 질문 전환과 점수 공개가 짧고 일관되며 `prefers-reduced-motion`을 지원한다. |
| 제스처 대체 | 좋음 | 오른쪽 스와이프로 이전 질문에 갈 수 있지만 항상 뒤로가기 버튼도 제공한다. |
| 색상 절제 | 좋음 | 라임·블루는 강조와 결과 공개에 집중하고 설문 화면은 중립색으로 유지한다. |
| 개인정보 설명 | 좋음 | 사진이 선택 사항이며 현재 MVP에서는 기기 밖으로 전송되지 않음을 촬영 전에 밝힌다. |

### 2.2 발견된 문제와 반영한 개선

| 문제 | 위험 | 이번 MVP 반영 |
|---|---|---|
| 36px 뒤로가기 버튼 | iOS 권장 터치 영역보다 작음 | 44×44px로 확대하고 헤더 레이아웃을 재조정했다. |
| 결과 화면의 8–10px 보조 텍스트 | 작은 화면·저시력 환경에서 읽기 어려움 | 중요 보조 텍스트를 11–15px로 올리고 어두운 배경의 대비를 높였다. |
| 색상으로만 선택을 전달할 가능성 | 색각 차이가 있는 사용자가 상태를 놓칠 수 있음 | 체크 아이콘과 `aria-pressed`를 함께 사용한다. |
| 진행률이 시각 요소에만 존재 | 스크린 리더가 진행 상황을 알기 어려움 | `role="progressbar"`와 현재 값을 추가했다. |
| 새로고침 시 진행 유실 | 모바일 브라우저 전환·메모리 회수 시 이탈 증가 | 질문·게임 진행을 로컬 draft로 저장하고 홈에서 이어하기를 제공한다. |
| 실제 AI를 호출하지 않지만 AI 결과로 표현 | 기능 신뢰 훼손 | 브리핑의 AI 라벨을 제거하고 현재는 로컬 규칙 기반 결과임을 유지한다. |
| 고정 시간마다 분석 단계가 바뀜 | 실제 작업 상태처럼 보이는 거짓 진행 | 점수 계산, 이미지 준비, 저장, 렌더 준비의 실제 완료 시점에 상태를 연결했다. |
| 모든 결과가 같은 캐릭터 색 | 개인화 체감이 약함 | 점수 유형/사진의 대표 색을 캐릭터 색 동조와 ID 번호에 반영한다. |
| 잘못된 사진 입력의 침묵 실패 | 사용자가 다음 행동을 알 수 없음 | 이미지 MIME, 12MB 제한, 읽기 실패 메시지를 추가했다. |
| 최근 결과가 없는데 결과 링크 노출 | 눌렀을 때 예상과 다른 이동 | 저장된 결과가 있을 때만 링크를 표시한다. |

### 2.3 다음 디자인 개선 우선순위

1. 200% 텍스트 확대에서도 질문·버튼이 잘리지 않는지 실제 iOS Safari로 검증한다.
2. 결과 공유를 텍스트뿐 아니라 1080×1350 카드 이미지로 제공한다.
3. 이미지 업로드 전 동의 내용을 한 화면에서 읽고 철회할 수 있는 privacy sheet를 추가한다.
4. 네트워크 버전에서는 업로드·AI 대기·실패·재시도 상태를 실제 job 상태와 연결한다.
5. VoiceOver/TalkBack, 키보드, 색 대비 자동 검사 결과를 릴리스 게이트로 만든다.

공식 기준: [Apple HIG](https://developer.apple.com/design/human-interface-guidelines), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures).

## 3. 제품 범위

### 3.1 빠른 감별 v1

- 질문 12개
- 패턴 게임 1개
- 눈 또는 손 사진 1장 선택 입력
- 규칙 기반 Alien Index와 신뢰도
- 등급 6종, 대표 유형 6종
- 외계인 캐릭터 1장
- 은하 문장과 결과 카드
- 최근 결과 저장, 공유, 삭제
- 회원가입 없이 시작

### 3.2 정밀 감별 v2

- 질문 24개
- 패턴·신호·그리기 게임 3개
- 눈과 손 사진 개별 입력
- 6개 세부 축과 친구 호환성
- 고품질 이미지 생성 옵션
- 계정 연결을 통한 여러 결과 보관

### 3.3 명시적 비목표

- 실제 생물학적 외계인 판별
- 얼굴·눈·손에서 인종, 건강, 성격, 지능 또는 질환 추론
- 공개 점수 순위표
- 동의 없는 타인의 사진 업로드
- 원본 사진이 포함된 공유 카드

## 4. 전체 시스템 구조

```text
모바일 브라우저
  ├─ Next.js 정적 앱 ─────────────── Firebase Hosting + CDN
  ├─ Anonymous Auth ─────────────── Firebase Authentication
  ├─ 앱 진위 증명 ───────────────── Firebase App Check
  ├─ 세션/상태 읽기 ─────────────── Cloud Firestore
  ├─ 비공개 이미지 직접 업로드 ──── Cloud Storage
  └─ Callable API
       └─ Cloud Functions v2
            ├─ 입력 검증 / 권한 / 일일 한도 / 멱등성
            ├─ Firestore 트랜잭션
            └─ Cloud Tasks enqueue
                  └─ AI worker
                       ├─ 이미지 정규화·EXIF 제거
                       ├─ 허용된 시각 특징 추출
                       ├─ 서버 규칙 점수 엔진
                       ├─ OpenAI 구조화 해설
                       ├─ OpenAI 이미지 생성
                       ├─ 결과·비용 메타데이터 저장
                       └─ 원본 사진 즉시 삭제
```

### 4.1 배포 선택

현재 메인 앱에는 서버 렌더링이 필요하지 않다. `next build`의 정적 export 결과를 Firebase Hosting에 배포하고 API는 Callable Functions로 분리한다.

- 장점: CDN 캐시, 낮은 운영비, 단순한 롤백, 프런트와 백엔드의 독립 배포
- 제약: 동적 메타데이터와 서버 컴포넌트 API 사용 불가
- 해결: 공유 URL `/r/{shareId}`만 Hosting rewrite로 Cloud Run 공유 렌더러에 연결
- 대안: SSR이 제품 전반에 필요해질 때 Cloud Run의 Next.js standalone 배포 또는 당시 공식 지원 버전의 Firebase App Hosting으로 이전

Firebase의 기존 Next.js Hosting 프레임워크 실험은 신규 참여가 닫혀 있고 App Hosting 사용이 권장되므로, 프레임워크 실험에 새로 의존하지 않는다. [Firebase Next.js Hosting 안내](https://firebase.google.com/docs/hosting/frameworks/nextjs), [Firebase App Hosting 프레임워크 지원](https://firebase.google.com/docs/app-hosting/frameworks-tooling).

## 5. 인증과 사용자 모델

### 5.1 기본 흐름

1. 첫 진입 시 Firebase Anonymous Authentication으로 UID를 받는다.
2. 질문은 로컬에 저장해 로그인이나 네트워크 없이 진행한다.
3. 서버 결과 생성이 필요한 순간에만 인증·App Check 토큰을 사용한다.
4. 사용자가 계정을 만들면 익명 계정을 이메일/소셜 계정에 link해 기존 결과를 유지한다.

Anonymous Auth는 회원가입 없는 경험과 UID 기반 Security Rules를 동시에 제공한다. [Firebase Anonymous Auth](https://firebase.google.com/docs/auth/web/anonymous-auth).

### 5.2 개인정보 최소화

- 이름, 생년월일, 성별, 국적을 받지 않는다.
- UID는 서비스 내부 식별자이며 공개 결과에는 포함하지 않는다.
- 분석 이벤트에는 질문 원문이나 사진 URL을 넣지 않는다.
- 사용자가 계정을 연결하지 않은 경우 만료 정책에 따라 익명 결과를 삭제한다.

## 6. Firestore 데이터 모델

```text
users/{uid}
  createdAt
  authMode: "anonymous" | "linked"
  locale: "ko-KR"
  consentVersion
  deleteRequestedAt?

users/{uid}/scans/{scanId}
  mode: "quick" | "precision"
  status: "draft" | "uploaded" | "queued" | "analyzing" | "generating" | "ready" | "failed" | "deleted"
  inputVersion: "quick-v1"
  scoringVersion: "score-v1"
  promptVersion: "result-v1"
  answers: map                  # 서버 점수 검증에 필요한 값만
  gameSignals: map
  photoKinds: ["eye" | "hand"]
  photoFeatures?: map           # 허용된 색·대비·제스처 필드만
  score?: number
  confidence?: number
  axes?: map
  archetype?: string
  grade?: string
  explanation?: map
  generatedAssetPath?: string   # 비공개 Storage 경로
  failure?: { code, retryable }
  createdAt
  updatedAt
  expiresAt                     # Firestore TTL

users/{uid}/usage/{yyyyMMdd}
  scansStarted
  imagesGenerated
  estimatedCostMicros
  updatedAt

jobs/{jobId}                    # 클라이언트 직접 접근 금지
  uid
  scanId
  kind: "analyze-and-generate"
  status
  attempt
  idempotencyKey
  traceId
  createdAt
  expiresAt

shares/{shareId}
  ownerUidHash                  # 원래 UID 저장 금지
  scanIdHash
  score
  grade
  archetype
  oneLiner
  crestSeed
  publicAssetPath
  createdAt
  expiresAt
  revokedAt?

admin/config                    # 관리자 custom claim만 접근
  textModel
  visionModel
  imageModel
  imageQuality
  quickModeEnabled
  precisionModeEnabled
  dailyImageLimit
  dailyCostLimitMicros
  activePromptVersions
```

### 6.1 설계 원칙

- 사용자 데이터는 항상 `users/{uid}` 아래에 둬 규칙을 단순하게 한다.
- 공개 공유 데이터는 원본 scan 문서를 노출하지 않고 별도 allowlist 스키마로 복사한다.
- 관리자 SDK는 Firestore Security Rules를 우회하므로 Functions 서비스 계정 IAM을 최소 권한으로 관리한다.
- 클라이언트 쿼리는 규칙 조건과 동일한 UID·limit 조건을 사용한다. Security Rules는 필터가 아니다. [Firestore Rules와 쿼리](https://firebase.google.com/docs/firestore/security/rules-query).

## 7. Storage 구조와 이미지 수명주기

```text
private/{uid}/scans/{scanId}/source/eye.webp
private/{uid}/scans/{scanId}/source/hand.webp
private/{uid}/scans/{scanId}/normalized/{kind}.webp
private/{uid}/scans/{scanId}/generated/alien.webp
public/shares/{shareId}/card.webp
```

### 7.1 업로드 규칙

- 인증 UID와 경로 UID가 같아야 한다.
- 허용 MIME: `image/jpeg`, `image/png`, `image/webp`, `image/heic` 지원 여부는 서버 디코더 기준으로 결정
- 클라이언트 제한 12MB, Storage Rules 제한 15MB, 서버 디코딩 후 픽셀 수 제한
- 업로드 metadata에 `scanId`, `kind`, `schemaVersion`만 허용
- 원본은 다운로드를 허용하지 않고 업로드·삭제만 허용
- 생성 이미지는 owner read, worker write

Storage Rules는 인증 UID 기반 경로와 크기·contentType을 모두 검증한다. [Storage Rules 조건](https://firebase.google.com/docs/storage/security/rules-conditions).

### 7.2 삭제 정책

| 데이터 | 정상 경로 | 안전망 |
|---|---|---|
| 원본 눈·손 사진 | 특징 추출 직후 worker가 삭제 | Cloud Storage lifecycle 24시간 |
| 정규화 중간 이미지 | 이미지 생성 직후 삭제 | lifecycle 24시간 |
| 비공개 생성 이미지 | 익명 30일, 연결 계정은 사용자가 삭제할 때까지 | 사용자 삭제 요청 처리 |
| 공유 카드 | 기본 90일 또는 공유 철회 즉시 | lifecycle + shares TTL |
| Firestore scan | 익명 30일, 계정 연결 시 정책에 따름 | `expiresAt` TTL |
| job·운영 임시 문서 | 완료 후 7일 | `expiresAt` TTL |

Firestore TTL 삭제는 만료 직후가 아니라 일반적으로 24시간 안에 처리될 수 있으므로 UI에는 이를 그대로 고지한다. [Firestore TTL](https://firebase.google.com/docs/firestore/ttl).

## 8. API 계약

모든 변경 API는 Callable Functions로 제공한다. Callable 요청에는 Firebase Auth와 App Check 토큰이 자동 포함될 수 있으므로 서버에서 둘 다 강제한다. [Callable Functions](https://firebase.google.com/docs/functions/callable).

### `createScan`

입력:

```json
{
  "mode": "quick",
  "inputVersion": "quick-v1",
  "answers": { "hidden-links": 3 },
  "gameSignals": { "patternChoice": 1 },
  "photoKinds": ["eye"],
  "consentVersion": "privacy-2026-07"
}
```

처리:

- auth, App Check, schema, 질문 ID와 값 범위 검증
- 일일 스캔·이미지·비용 한도 트랜잭션 확인
- scan ID와 허용 upload path 생성
- `status="draft"` 반환

### `finalizeScan`

입력: `{ scanId, idempotencyKey }`

- 입력 이미지 존재·크기·종류 확인
- 이미 처리된 idempotency key면 같은 응답 반환
- `uploaded → queued` 트랜잭션
- Cloud Task enqueue
- 즉시 `{ scanId, status: "queued" }` 반환

### `retryScan`

- `failed && failure.retryable == true`일 때만 허용
- 사용량을 이중 차감하지 않는다.
- 동일 원본이 삭제된 경우 사진 없이 재계산하거나 재업로드를 요청한다.

### `createShare`

- ready scan에서 공유 허용 필드만 복사
- 원본 답변, 신뢰도, UID, 사진 특징은 제외
- shareId는 추측 불가능한 랜덤 값
- 공개 카드 생성 task enqueue

### `revokeShare` / `deleteMyData`

- 공유 문서와 공개 이미지를 즉시 비활성화
- 사용자 하위 컬렉션과 Storage prefix 삭제를 비동기 수행
- 삭제 요청 상태와 완료 시각만 최소 기간 보관

## 9. AI 작업 파이프라인

### 9.1 Task Queue worker

1. job/scan을 트랜잭션으로 claim한다.
2. 이미지 magic bytes, 실제 MIME, 픽셀 수, 디코딩 가능 여부를 재검증한다.
3. 방향을 정규화하고 EXIF·위치 메타데이터를 제거한다.
4. 허용된 시각 특징만 추출한다.
5. 서버의 고정 점수 엔진으로 점수와 6개 축을 계산한다.
6. 점수·축·선택 환경만 OpenAI 텍스트 모델에 보내 구조화 해설을 만든다.
7. 사진 원본 대신 허용 특징과 선택적으로 정규화된 crop을 이미지 생성 API에 전달한다.
8. 생성물을 Storage에 저장하고 scan을 `ready`로 전환한다.
9. 원본과 중간 이미지를 삭제한다.
10. 비용·지연·모델·프롬프트 버전만 기록한다.

Cloud Tasks는 긴 AI 작업을 요청 응답에서 분리하고 재시도·동시성·속도 제한을 설정하는 데 사용한다. 권장 초기값은 `maxAttempts=3`, 지수 backoff, 이미지 생성 동시성 3이다. [Firebase Task Queue Functions](https://firebase.google.com/docs/functions/task-functions).

### 9.2 점수와 생성형 AI의 경계

- 점수는 항상 버전이 고정된 서버 규칙 엔진이 계산한다.
- AI는 점수·유형을 바꾸지 못한다.
- AI 출력은 설명과 이미지 프롬프트에만 사용한다.
- 모든 AI 출력은 schema validation 후 allowlist 필드만 저장한다.
- 모델명은 코드가 아니라 `admin/config`에서 교체하되, 배포 전 eval을 통과한 값만 활성화한다.

텍스트 결과 예시 스키마:

```json
{
  "schemaVersion": "result-copy-v1",
  "oneLiner": "string, 55자 이하",
  "archetypeDescription": "string, 160자 이하",
  "strongSignals": [
    { "axis": "dream", "copy": "string, 70자 이하" }
  ],
  "earthSkill": "string, 80자 이하",
  "playfulCaution": "string, 80자 이하",
  "imagePrompt": {
    "personality": ["curious", "gentle"],
    "palette": ["ion-blue", "alien-lime"],
    "world": "blue-ice",
    "visualMarks": ["curved-spiral"]
  }
}
```

### 9.3 OpenAI 호출 원칙

- API 키는 브라우저나 Next.js public env에 두지 않고 Secret Manager에 저장한다.
- 키 secret은 AI worker 함수에만 bind한다. [Cloud Functions secrets](https://firebase.google.com/docs/functions/config-env).
- 텍스트는 Responses API에서 저장이 필요 없도록 `store: false`를 사용한다.
- 설명은 JSON schema 기반 Structured Outputs로 받고 서버에서 한 번 더 검증한다.
- 이미지 생성 모델은 관리자 설정으로 선택하고 품질·크기·일일 한도를 분리한다.
- 입력은 원문 설문 전체가 아니라 구조화된 축과 허용된 시각 특징으로 최소화한다.
- OpenAI API 데이터는 명시적 opt-in 없이 모델 학습에 사용되지 않지만, 기본 악용 모니터링 로그는 최대 30일 보관될 수 있음을 개인정보 안내에 명시한다. [OpenAI API 데이터 제어](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint).
- 이미지 모델의 지원 입력·출력과 사용 가능 모델은 릴리스 시점에 공식 모델 문서에서 재확인한다. [OpenAI 이미지 모델](https://developers.openai.com/api/docs/models/gpt-image-2).

## 10. 보안 설계

### 10.1 방어 계층

1. Anonymous Auth: 사용자 데이터 소유권
2. App Check: 정식 웹앱에서 온 요청인지 증명
3. Security Rules: UID 경계, 스키마·크기·상태 전이 제한
4. Callable validation: 값 범위, 멱등성, 일일 한도
5. IAM: worker만 jobs와 전체 Storage를 읽도록 최소 권한
6. Secret Manager: AI 키를 worker에만 노출
7. Task Queue rate limit: 외부 API와 비용 급증 보호
8. 예산 알림과 kill switch: 일일 비용 초과 시 이미지 생성을 중단하고 로컬 캐릭터 결과 제공

App Check와 Authentication은 각각 앱과 사용자를 보호하는 상호 보완 계층이다. 웹은 reCAPTCHA Enterprise provider를 우선 사용하고, 먼저 metrics를 관찰한 뒤 enforcement를 켠다. [Firebase App Check](https://firebase.google.com/docs/app-check), [웹 reCAPTCHA provider](https://firebase.google.com/docs/app-check/web/recaptcha-provider).

### 10.2 Security Rules 개념 예시

```text
match /users/{uid} {
  allow read, create, update: if request.auth.uid == uid;
  allow delete: if false; // deleteMyData 함수로만 수행

  match /scans/{scanId} {
    allow read: if request.auth.uid == uid;
    allow create, update, delete: if false; // 상태 전이는 Functions만 수행
  }
}

match /shares/{shareId} {
  allow read: if resource.data.revokedAt == null
              && resource.data.expiresAt > request.time;
  allow write: if false;
}

match /{document=**} {
  allow read, write: if false;
}
```

실제 Rules는 Emulator Suite와 `@firebase/rules-unit-testing`으로 허용·거부 케이스를 자동 검증한다. [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite), [Rules unit testing](https://firebase.google.com/docs/rules/unit-tests).

## 11. 신뢰성, 실패 처리, 멱등성

### 상태 전이

```text
draft → uploaded → queued → analyzing → generating → ready
                           └──────────────→ failed → queued (retry)
ready → deleted
```

- `finalizeScan`은 `scanId + idempotencyKey`로 중복 enqueue를 막는다.
- worker는 Firestore transaction으로 job lease를 얻고 lease 만료 후에만 다른 worker가 재시도한다.
- 이미지 생성 성공 후 Firestore 저장 실패에 대비해 asset metadata에 scanId를 기록한다.
- ready 이전 생성물은 공개 경로에 두지 않는다.
- AI 실패 시 사진을 재전송하기 전에 원본 존재와 사용자 동의를 다시 확인한다.
- 텍스트 해설만 실패하면 규칙 기반 기본 카피로 ready 처리할 수 있다.
- 이미지 생성이 비용 한도나 장애로 중단되면 현재 MVP의 로컬 캐릭터를 사용하고 재시도 버튼을 제공한다.

## 12. 비용과 악용 제어

초기 기본값:

- 익명 UID당 하루 빠른 감별 10회
- AI 이미지 생성 3회
- 동일 IP/App Check risk 조합에 별도 soft limit
- 이미지 최대 12MB, 최대 20MP
- queue 동시 처리 3, 초당 dispatch 1
- 사용자별·프로젝트별 일일 비용 상한
- 관리자 kill switch: `imageGenerationEnabled=false`

비용 기록은 요청 전에 reservation하고 성공·실패 후 reconcile한다. 클라이언트가 보내는 비용이나 완료 횟수는 신뢰하지 않는다.

## 13. 관측성과 운영

### 필수 메트릭

- scan 시작·완료·이탈률과 화면별 체류시간
- photo opt-in 비율
- queue 대기, 분석, 이미지 생성 p50/p95 지연
- worker 재시도율과 실패 코드
- scan당 추정 API 비용
- App Check 거부율, rate limit 발생률
- 원본 사진 삭제 성공률과 24시간 이상 잔존 객체 수
- 공유 생성·철회율

### 로그 원칙

- 구조화 로그에 `traceId`, `scanId`의 비가역 hash, 단계, 모델·프롬프트 버전만 기록한다.
- 사진 URL, base64, 원문 답변, OpenAI 응답 전문을 로그에 남기지 않는다.
- 오류는 사용자 메시지용 code와 내부 detail을 분리한다.
- 개인정보 접근 audit log와 관리자 설정 변경 이력을 보관한다.

## 14. 테스트 전략

### 프런트엔드

- 질문 12개, 이전 버튼, 스와이프, 새로고침 이어하기
- 사진 없음/정상/잘못된 MIME/초과 크기/디코딩 실패
- 낮은 점수와 높은 점수 모두 긍정적 문구
- Web Share 지원/미지원/취소
- 320–430px 폭, safe area, 가로 overflow
- 200% 텍스트 확대, reduced motion, 키보드, VoiceOver/TalkBack
- 어두운 결과 화면 WCAG AA 대비

### 백엔드

- Firestore/Storage Rules allow·deny unit tests
- auth 없음, App Check 없음, 타 UID 접근 차단
- create/finalize 중복 호출 멱등성
- 일일 한도 transaction race
- task retry와 lease 만료
- AI schema invalid, timeout, 429, 5xx fallback
- 원본·중간 이미지 삭제와 lifecycle 안전망
- share 문서에 금지 필드가 없는지 snapshot test
- Emulator Suite 통합 테스트 후 staging 프로젝트 E2E

## 15. 단계별 출시 계획

### Phase 0 — 현재 로컬 MVP

- 로컬 규칙 점수와 로컬 사진 특징 분석
- 정적 외계인 자산의 유형별 색 동조
- 로컬 draft와 최근 결과
- 텍스트 공유

### Phase 1 — Firebase 기반 비AI 베타

- Anonymous Auth, App Check monitor mode
- Firestore scan, Storage private paths, Callable API
- 서버 점수 엔진을 현재 클라이언트 엔진과 golden test로 동기화
- Firebase Hosting 정적 배포, Emulator·Rules 테스트
- 삭제 요청과 운영 대시보드

### Phase 2 — 제한된 AI 베타

- Task Queue, Secret Manager, OpenAI 구조화 해설
- 이미지 생성은 allowlisted 사용자와 낮은 일일 한도로 시작
- 비용 예약, kill switch, 기본 캐릭터 fallback
- 원본 자동 삭제와 잔존 객체 모니터링 검증
- App Check enforcement 전환

### Phase 3 — 공개 출시

- AI 이미지 생성 일반 공개
- 공유 카드와 동적 OG 페이지
- 계정 연결, 결과 여러 개 보관
- 개인정보 처리방침, 이용약관, 삭제 SLA, 장애 대응 runbook
- 부하·비용·악용 시나리오 테스트 완료

## 16. 프로덕션 완료 기준

- [ ] 모든 핵심 컨트롤이 최소 44px 터치 영역을 갖는다.
- [ ] 200% 텍스트와 reduced motion에서 핵심 흐름을 완료할 수 있다.
- [ ] 사진 없이도 같은 수준의 결과를 받을 수 있다.
- [ ] 점수는 동일 입력에 항상 동일하고 scoring version이 기록된다.
- [ ] API 키가 클라이언트 번들·로그·Firestore에 존재하지 않는다.
- [ ] Auth + App Check + Rules + 서버 rate limit가 모두 적용된다.
- [ ] 원본 사진 삭제율 100%를 모니터링하고 24시간 lifecycle 안전망이 있다.
- [ ] 공개 share 스키마에 사진·답변·UID·신뢰도가 없다.
- [ ] Security Rules와 멱등성·한도 경쟁 조건 테스트가 CI에서 통과한다.
- [ ] AI 장애·비용 제한 시 규칙 기반 기본 결과로 graceful degradation한다.
- [ ] 개인정보 안내에 Firebase/OpenAI 처리자, 목적, 보관 기간, 삭제 방법이 명시된다.
- [ ] staging에서 전체 E2E, 접근성, Core Web Vitals, 복구 훈련을 통과한다.
