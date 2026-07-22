# Alien Index MVP

모바일 우선으로 만든 1분 외계인 성향 테스트입니다. 모든 점수 계산과 사진의 시각 신호 분석은 브라우저에서 실행되며, 현재 버전은 백엔드나 API 키가 필요하지 않습니다.

## 로컬 프리뷰

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 프로덕션 빌드는 다음 명령으로 확인할 수 있습니다.

```bash
npm run typecheck
npm run build
npm start
```

## 구현 범위

- 12개 성향 질문과 이전 질문 스와이프
- 패턴 직관 게임 1개
- 선택형 눈/손 이미지 입력
- 이미지 색상·대비·품질의 온디바이스 분석
- 완료 모듈에 따라 가중치를 재조정하는 규칙 기반 점수 엔진
- 0~100 Alien Index, 6개 등급, 6개 대표 유형, 스캔 신뢰도
- 결과용 외계인 캐릭터, 은하 문장, 상위 신호와 지구 적응 능력
- Web Share API와 클립보드 대체 동작
- 최근 결과의 로컬 저장 및 PWA 매니페스트
- 진행 중 새로고침 후 이어하기
- 입력 이미지 형식·크기 검증과 오류 안내
- 결과 유형에 따른 캐릭터 색상·신분 번호 개인화
- `prefers-reduced-motion` 접근성 대응

## Firebase 연결 지점

[`lib/session-store.ts`](./lib/session-store.ts)의 `ScanRepository` 인터페이스를 Firestore 구현체로 교체하면 UI나 점수 엔진을 바꾸지 않고 세션 저장을 Firebase로 이전할 수 있습니다. 사진은 현재 원본을 저장하지 않으며, 이후 Storage를 연결하더라도 EXIF 제거·자동 삭제 정책을 서버에서 추가해야 합니다.

점수 계산은 [`lib/scoring.ts`](./lib/scoring.ts), 사진의 허용된 시각 특징 추출은 [`lib/photo-analyzer.ts`](./lib/photo-analyzer.ts)에 분리되어 있습니다.

Apple HIG 감사 결과와 실제 공개 서비스를 위한 Firebase·Cloud Tasks·OpenAI 백엔드 구조, 데이터 모델, 보안 규칙, 삭제 정책과 출시 단계는 [`docs/production-service-design.md`](./docs/production-service-design.md)에 정리되어 있습니다.
