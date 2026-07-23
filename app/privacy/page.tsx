import type { Metadata } from "next";
import { sitePath } from "@/lib/site-path";

export const metadata: Metadata = {
  title: "개인정보 안내 · Alien Index",
  description: "Alien Index의 사진, 감별 결과 및 서비스 데이터 처리 안내",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <a className="privacy-back" href={sitePath("/")}>← Alien Index로 돌아가기</a>
      <p className="eyebrow">PRIVACY · 2026-07</p>
      <h1>개인정보 처리 안내</h1>
      <p className="privacy-lead">Alien Index는 이름·생년월일·성별·국적을 받지 않으며, 재미를 위한 감별에 필요한 최소 정보만 처리합니다.</p>

      <section>
        <h2>처리하는 정보와 목적</h2>
        <ul>
          <li>Firebase 익명 UID: 회원가입 없이 결과를 본인에게만 제공하기 위해 사용합니다.</li>
          <li>질문 점수와 게임 선택: 버전이 고정된 규칙 엔진으로 Alien Index 결과를 계산합니다.</li>
          <li>선택한 눈 또는 손 사진: 색상·대비 등 허용된 시각 특징을 추출하는 용도로만 사용합니다.</li>
          <li>운영 정보: 오류 코드, 처리 지연, 모델·프롬프트 버전과 비가역 식별자를 안정성 및 악용 방지에 사용합니다.</li>
        </ul>
      </section>

      <section>
        <h2>처리자와 전송</h2>
        <p>Google Firebase가 인증, 데이터베이스, 비공개 파일 저장, 서버 작업과 호스팅을 처리합니다. OpenAI 기능이 활성화되는 경우 사진 원본이나 질문 원문 대신 구조화된 점수 축과 허용된 시각 특징만 해설·이미지 생성에 사용하며, 별도 안내와 동의를 거칩니다.</p>
        <p>OpenAI API 입력은 모델 학습에 사용되지 않지만 안전성 모니터링 로그가 최대 30일 보관될 수 있습니다.</p>
      </section>

      <section>
        <h2>보관 기간</h2>
        <ul>
          <li>원본·정규화 사진: 처리 직후 삭제하며, 실패 시에도 최대 24시간 뒤 Storage lifecycle로 삭제합니다.</li>
          <li>익명 계정 감별 결과: 기본 30일</li>
          <li>공개 공유 카드: 공유 철회 즉시 또는 기본 90일</li>
          <li>작업 문서와 운영 임시 데이터: 완료 후 최대 7일</li>
        </ul>
        <p>Firestore TTL 삭제는 만료 직후가 아니라 일반적으로 24시간 안에 처리될 수 있습니다.</p>
      </section>

      <section>
        <h2>선택과 삭제</h2>
        <p>사진은 선택 사항이며 사진 없이도 같은 규칙 기반 결과를 받을 수 있습니다. 결과 화면의 삭제 기능 또는 서비스 내 삭제 요청을 사용하면 비공개 결과, 사진, 공유 데이터가 비동기 삭제됩니다. 공유 카드에는 UID, 답변, 신뢰도, 원본 사진 또는 사진 특징이 포함되지 않습니다.</p>
      </section>

      <section>
        <h2>문의</h2>
        <p>현재 베타 운영자의 별도 연락처가 게시되기 전에는 서비스를 사용하지 않거나 브라우저의 사이트 데이터 삭제 기능으로 로컬 결과를 제거할 수 있습니다.</p>
      </section>

      <p className="privacy-version">동의 버전: privacy-2026-07</p>
    </main>
  );
}
