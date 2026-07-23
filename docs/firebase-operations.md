# Firebase 운영 절차

## 배포 대상

- 프로젝트: `alien-index`
- 리전: `asia-northeast3`
- Hosting: Next.js 정적 export `out/`
- Functions: Node.js 22, 2세대 Callable/Task Queue
- Firestore/Storage Rules: 기본 거부, UID 소유권 기반 읽기

## 최초 프로젝트 설정

1. Blaze 결제 플랜과 예산 알림을 설정한다.
2. Firestore `(default)` 데이터베이스를 `asia-northeast3`에 만든다.
3. Firebase Storage 기본 버킷을 만든다.
4. Authentication에서 Anonymous provider를 활성화한다.
5. reCAPTCHA Enterprise 사이트 키를 만들고 Firebase App Check 웹 앱에 등록한다.
6. `.env.local`의 `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`를 설정하고 metrics를 관찰한다.
7. Functions의 `enforceAppCheck`를 `true`로 바꿔 재배포한다.

## 로컬 검증

```bash
npm ci
npm ci --prefix functions
npm run typecheck
npm run build
npm run test:firebase
```

## 배포

```bash
npm run deploy:firebase
npm run configure:firebase
npm run configure:openai-secret
```

`configure:firebase`는 `.env.local`의 Storage 버킷을 사용해 24시간 private 객체 lifecycle과
`scans`, `jobs`, `shares` collection group의 `expiresAt` TTL을 적용하고 `admin/config` 기본값을
서버 SDK로 병합한 뒤 TTL 목록을 출력한다. 이 명령은 Application Default Credentials가 필요하다.

`configure:openai-secret`는 `.env.local`의 `OPENAI_API_KEY`를 브라우저 번들에 포함하지 않고
Firebase Functions Secret Manager의 `OPENAI_API_KEY`로 등록한다. `--check`를 붙이면 원격 변경 없이
키 이름과 존재 여부만 확인한다. AI는 `admin/config.imageGenerationEnabled`와 모델 설정이 명시적으로
활성화된 경우에만 호출된다.

배포 후 `admin/config` 문서를 만들고 다음 기본값을 검토한다.

```json
{
  "quickModeEnabled": true,
  "precisionModeEnabled": false,
  "imageGenerationEnabled": false,
  "dailyScanLimit": 10,
  "dailyImageLimit": 3,
  "dailyCostLimitMicros": 1000000,
  "textModel": "disabled",
  "visionModel": "disabled",
  "imageModel": "disabled",
  "imageQuality": "standard",
  "activePromptVersions": {"result": "result-v1"}
}
```

## 보존 정책

- `storage-lifecycle.json`을 기본 버킷에 적용한다. 업로드 후 finalize되지 않은 객체도 지워지도록 private 객체 생성 시각 기준 1일 후 삭제한다.
- worker는 정상 처리 직후 원본을 삭제하고 `source-delete-complete` 또는 `source-delete-pending-lifecycle` 구조화 로그를 남긴다.
- `scans`, `jobs`, `shares` collection group의 `expiresAt`에 Firestore TTL을 설정한다.
- `monitorRetention`이 매일 24시간 이상 잔존 private 객체를 검사해 `retention-stale-private-objects` 오류 로그를 남긴다.
- 위 오류 로그, queue retry, App Check 거부율을 Cloud Monitoring에서 경보로 만든다.

## 장애 시 동작

- Callable, queue, 이미지 분석이 실패하면 웹 앱은 동일한 `score-v1` 로컬 엔진 결과를 제공한다.
- `admin/config.imageGenerationEnabled=false`가 기본 kill switch다.
- 원본 사진은 worker 성공 직후 삭제되고 Storage lifecycle이 24시간 안전망으로 동작한다.
