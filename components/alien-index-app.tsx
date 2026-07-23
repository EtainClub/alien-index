"use client";

import Image from "next/image";
import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFirebaseServices, signInWithGoogle } from "@/lib/firebase/client";
import { requestRemoteDataDeletion, runRemoteScan } from "@/lib/firebase/scan-service";
import { analyzePhoto } from "@/lib/photo-analyzer";
import { AlienResult, calculateResult, PhotoSignal, questions } from "@/lib/scoring";
import { ScanDraft, scanRepository } from "@/lib/session-store";
import { sitePath } from "@/lib/site-path";

type Screen = "home" | "briefing" | "quiz" | "game" | "photo" | "analysis" | "result";

const answerOptions = [
  { value: 0, label: "전혀 아니다" },
  { value: 1, label: "별로 아니다" },
  { value: 2, label: "조금 그렇다" },
  { value: 3, label: "꽤 그렇다" },
  { value: 4, label: "매우 그렇다" },
];

const glyphOptions = ["△", "◐", "✦", "◑"];

function draftProgress(draft: ScanDraft | null) {
  if (!draft) return null;
  if (draft.screen === "briefing") return 4;
  if (draft.screen === "game") return 69;
  if (draft.screen === "photo") return 82;
  return Math.round(8 + (draft.questionIndex / questions.length) * 55);
}

function Icon({ name, size = 20 }: { name: "arrow" | "back" | "camera" | "spark" | "game" | "question" | "share" | "refresh" | "check" | "shield" | "image"; size?: number }) {
  const paths: Record<typeof name, React.ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    back: <><path d="m15 18-6-6 6-6"/></>,
    camera: <><path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"/><circle cx="12" cy="12" r="4"/></>,
    spark: <><path d="m12 3-1.1 3.2a7 7 0 0 1-4.7 4.7L3 12l3.2 1.1a7 7 0 0 1 4.7 4.7L12 21l1.1-3.2a7 7 0 0 1 4.7-4.7L21 12l-3.2-1.1a7 7 0 0 1-4.7-4.7L12 3Z"/></>,
    game: <><path d="M8 8h8a5 5 0 0 1 4.8 6.4l-1 3.2a2 2 0 0 1-3.3.9L14 16h-4l-2.5 2.5a2 2 0 0 1-3.3-.9l-1-3.2A5 5 0 0 1 8 8Z"/><path d="M8 11v4M6 13h4M16 12h.01M18 15h.01"/></>,
    question: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 3.5 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01"/></>,
    share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    shield: <><path d="M12 3 4.5 6v5.2c0 4.5 3 7.8 7.5 9.8 4.5-2 7.5-5.3 7.5-9.8V6L12 3Z"/><path d="m9 12 2 2 4-4"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m4 17 4.5-4.5 3.5 3 2.5-2.5 5.5 5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`brand ${inverse ? "brand--inverse" : ""}`} aria-label="Alien Index">
      <span className="brand__mark"><span /></span>
      <span>ALIEN INDEX</span>
    </div>
  );
}

function ProgressHeader({ progress, onBack, label }: { progress: number; onBack: () => void; label: string }) {
  return (
    <header className="flow-header">
      <button className="icon-button" onClick={onBack} aria-label="이전으로"><Icon name="back" /></button>
      <div className="flow-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={`${Math.round(progress * 100)}% 완료`}>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="flow-label">{label}</span>
    </header>
  );
}

function HomeScreen({
  onStart,
  onRestore,
  onResume,
  hasResult,
  draftProgress,
}: {
  onStart: () => void;
  onRestore: () => void;
  onResume: () => void;
  hasResult: boolean;
  draftProgress: number | null;
}) {
  return (
    <main className="screen home-screen">
      <div className="home-nav">
        <Brand />
        <span className="time-chip"><span /> 약 1분</span>
      </div>

      <section className="hero">
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit orbit--one" />
          <div className="orbit orbit--two" />
          <div className="planet"><span className="planet__eye planet__eye--left"/><span className="planet__eye planet__eye--right"/><span className="planet__smile"/></div>
          <span className="satellite satellite--one" />
          <span className="satellite satellite--two" />
        </div>
        <p className="eyebrow">EARTH COMPATIBILITY SCAN</p>
        <h1>당신은 지구에 얼마나<br/><span>잘 섞여 있는 외계인</span>일까요?</h1>
        <p className="hero-copy">눈, 감각, 꿈과 사고 패턴으로<br/>당신 안의 낯선 신호를 측정합니다.</p>
      </section>

      <div className="home-actions">
        <button className="primary-button" onClick={onStart}>
          {draftProgress === null ? "빠른 감별 시작하기" : "새 감별 시작하기"} <Icon name="arrow" />
        </button>
        {draftProgress !== null && (
          <button className="resume-card" onClick={onResume}>
            <span className="resume-card__icon"><Icon name="spark" size={19}/></span>
            <span><strong>이어서 감별하기</strong><small>{draftProgress}%에서 신호가 잠시 멈춰 있어요</small></span>
            <Icon name="arrow" size={18}/>
          </button>
        )}
        <button className="precision-button" type="button" disabled aria-label="정밀 감별은 준비 중입니다">
          <span><Icon name="spark" size={18}/> 정밀 감별</span>
          <small>COMING SOON</small>
        </button>
        {hasResult && <button className="restore-button" onClick={onRestore}>최근 외계인 신분증 보기</button>}
        <p className="privacy-line"><Icon name="shield" size={16}/> 회원가입 없이 시작 · <a href={sitePath("/privacy")}>개인정보 안내</a></p>
      </div>
    </main>
  );
}

function BriefingScreen({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const items = [
    { icon: "question" as const, count: "12", title: "성향 질문", copy: "꿈과 사고방식을 탐색해요" },
    { icon: "game" as const, count: "01", title: "신호 게임", copy: "직관으로 다음 신호를 골라요" },
    { icon: "camera" as const, count: "선택", title: "눈 또는 손 사진", copy: "색과 빛의 분위기만 읽어요" },
    { icon: "spark" as const, count: "결과", title: "외계인 신분증", copy: "나만의 유형과 캐릭터를 받아요" },
  ];
  return (
    <main className="screen briefing-screen">
      <ProgressHeader progress={0.04} onBack={onBack} label="브리핑" />
      <section className="briefing-copy enter-up">
        <p className="eyebrow">QUICK SCAN</p>
        <h2>짧지만 꽤 정교한<br/>네 번의 신호 확인</h2>
        <p>정답은 없습니다. 가장 먼저 끌리는 쪽을 선택하세요.</p>
      </section>
      <section className="mission-list enter-up enter-delay-1">
        {items.map((item, index) => (
          <div className="mission" key={item.title}>
            <span className="mission__icon"><Icon name={item.icon} /></span>
            <div><h3>{item.title}</h3><p>{item.copy}</p></div>
            <span className="mission__count">{item.count}</span>
            {index < items.length - 1 && <span className="mission__line" />}
          </div>
        ))}
      </section>
      <div className="sticky-action">
        <button className="primary-button" onClick={onStart}>신호 스캔 시작 <Icon name="arrow" /></button>
        <p>재미를 위한 성향 테스트이며 생물학적 판별이 아닙니다.</p>
      </div>
    </main>
  );
}

function QuizScreen({
  index,
  answers,
  onAnswer,
  onBack,
}: {
  index: number;
  answers: Record<string, number>;
  onAnswer: (value: number) => void;
  onBack: () => void;
}) {
  const question = questions[index];
  const pointerStart = useRef<number | null>(null);
  const handlePointerDown = (event: PointerEvent<HTMLElement>) => { pointerStart.current = event.clientX; };
  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (pointerStart.current !== null && event.clientX - pointerStart.current > 70) onBack();
    pointerStart.current = null;
  };
  return (
    <main className="screen quiz-screen" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <ProgressHeader progress={0.08 + (index / questions.length) * 0.55} onBack={onBack} label={`${String(index + 1).padStart(2, "0")} / ${questions.length}`} />
      <section className="question-card" key={question.id} aria-live="polite" aria-atomic="true">
        <p className="eyebrow">{question.eyebrow}</p>
        <h2>{question.text}</h2>
        <p className="question-hint">{question.hint}</p>
      </section>
      <section className="answer-list" key={`answers-${question.id}`}>
        {answerOptions.map((option, optionIndex) => {
          const selected = answers[question.id] === option.value;
          return (
            <button
              className={`answer-button ${selected ? "is-selected" : ""}`}
              key={option.value}
              onClick={() => onAnswer(option.value)}
              aria-pressed={selected}
              style={{ animationDelay: `${optionIndex * 35}ms` }}
            >
              <span className="answer-radio">{selected && <span />}</span>
              <span>{option.label}</span>
              {selected && <Icon name="check" size={18}/>}
            </button>
          );
        })}
      </section>
      <p className="swipe-hint">오른쪽으로 밀면 이전 질문으로 돌아가요</p>
    </main>
  );
}

function GameScreen({ selected, onSelect, onBack, onNext }: { selected: number | null; onSelect: (index: number) => void; onBack: () => void; onNext: () => void }) {
  return (
    <main className="screen game-screen">
      <ProgressHeader progress={0.69} onBack={onBack} label="신호 게임" />
      <section className="game-copy enter-up">
        <span className="game-tag"><Icon name="game" size={17}/> 직관 테스트</span>
        <h2>다음에 올 신호를<br/>느낌대로 골라보세요.</h2>
        <p>오래 생각하지 않아도 괜찮아요. 여러 규칙이 숨어 있습니다.</p>
      </section>
      <section className="sequence-card enter-up enter-delay-1" aria-label="신호 순서">
        {["○", "◐", "●", "◑", "○"].map((glyph, index) => <span key={index}>{glyph}</span>)}
        <span className="sequence-question">?</span>
      </section>
      <section className="glyph-grid enter-up enter-delay-2">
        {glyphOptions.map((glyph, index) => (
          <button key={glyph} className={selected === index ? "is-selected" : ""} onClick={() => onSelect(index)} aria-pressed={selected === index} aria-label={`${glyph} 신호 선택`}>
            {glyph}
            {selected === index && <span className="choice-check"><Icon name="check" size={13}/></span>}
          </button>
        ))}
      </section>
      <div className="sticky-action">
        <button className="primary-button" disabled={selected === null} onClick={onNext}>이 신호로 결정 <Icon name="arrow" /></button>
      </div>
    </main>
  );
}

function PhotoScreen({
  file,
  preview,
  signal,
  isReading,
  error,
  onFile,
  onBack,
  onNext,
}: {
  file: File | null;
  preview: string | null;
  signal: PhotoSignal | null;
  isReading: boolean;
  error: string | null;
  onFile: (file: File) => Promise<void>;
  onBack: () => void;
  onNext: (includePhoto: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const [cameraState, setCameraState] = useState<"closed" | "opening" | "open">("closed");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const releaseCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const closeCamera = useCallback(() => {
    releaseCamera();
    setCameraState("closed");
    setIsCapturing(false);
  }, [releaseCamera]);

  useEffect(() => releaseCamera, [releaseCamera]);

  const openCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("이 브라우저에서는 직접 촬영을 지원하지 않아요. 보관함에서 사진을 선택해주세요.");
      return;
    }

    const requestId = cameraRequestRef.current + 1;
    cameraRequestRef.current = requestId;
    setCameraState("opening");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable");
      video.srcObject = stream;
      await video.play();
      setCameraState("open");
    } catch (cameraAccessError) {
      if (cameraRequestRef.current !== requestId) return;
      releaseCamera();
      setCameraState("closed");
      const denied = cameraAccessError instanceof DOMException
        && (cameraAccessError.name === "NotAllowedError" || cameraAccessError.name === "SecurityError");
      setCameraError(denied
        ? "카메라 권한이 필요해요. 브라우저 설정에서 권한을 허용한 뒤 다시 시도해주세요."
        : "카메라를 열지 못했어요. 다른 앱이 카메라를 사용 중인지 확인하거나 보관함을 이용해주세요.");
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("카메라 화면을 준비하는 중이에요. 잠시 후 다시 촬영해주세요.");
      return;
    }

    setIsCapturing(true);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setIsCapturing(false);
      setCameraError("촬영한 사진을 처리하지 못했어요. 다시 시도해주세요.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      setIsCapturing(false);
      setCameraError("촬영한 사진을 저장하지 못했어요. 다시 시도해주세요.");
      return;
    }

    const capturedFile = new File([blob], `alien-signal-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    closeCamera();
    await onFile(capturedFile);
  };

  const cameraVisible = cameraState !== "closed";

  return (
    <main className="screen photo-screen">
      <ProgressHeader progress={0.82} onBack={onBack} label="선택 신호" />
      <section className="photo-copy enter-up">
        <div className="optional-chip">OPTIONAL · 선택 사항</div>
        <h2>눈 또는 손의<br/>빛 신호를 더할까요?</h2>
        <p>얼굴 전체는 필요 없어요. 선택한 사진은 비공개로 전송되며 특징 분석 직후 삭제됩니다.</p>
      </section>
      <div className={`photo-zone ${preview ? "has-photo" : ""}`}>
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="촬영하거나 선택한 눈 또는 손 사진 미리보기" />
            <span className="photo-change"><Icon name="check" size={17}/> 사진 준비 완료</span>
            {isReading && <span className="photo-reading" role="status">시각 신호 읽는 중…</span>}
          </>
        ) : (
          <div className="photo-placeholder">
            <div className="scan-frame"><span/><span/><span/><span/><Icon name="camera" size={32}/></div>
            <strong>직접 촬영하거나 사진을 선택하세요</strong>
            <span>눈 주변이나 손의 포즈가 보이면 충분해요</span>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        className="photo-file-input"
        tabIndex={-1}
        aria-hidden="true"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const selectedFile = event.currentTarget.files?.[0];
          if (selectedFile) void onFile(selectedFile);
          event.currentTarget.value = "";
        }}
      />
      <div className="photo-source-actions" aria-label="사진 가져오기">
        <button type="button" className="camera-source-button" onClick={() => void openCamera()}>
          <Icon name="camera" size={19}/> 사진 촬영
        </button>
        <button type="button" className="library-source-button" onClick={() => fileInputRef.current?.click()}>
          <Icon name="image" size={19}/> 보관함에서 선택
        </button>
      </div>
      {signal && (
        <div className="signal-readout">
          <span className="signal-dot" style={{ background: `hsl(${signal.dominantHue} 70% 58%)` }}/>
          <div><strong>{signal.qualityLabel}</strong><small>색상과 대비 신호 확인 완료</small></div>
          <Icon name="check" size={18}/>
        </div>
      )}
      {(error || cameraError) && <p className="photo-error" role="alert">{cameraError || error}</p>}
      <div className="sticky-action photo-actions">
        <button className="primary-button" disabled={isReading} onClick={() => onNext(Boolean(file && signal))}>{file ? "이 신호 사용하기" : "사진 없이 분석하기"} <Icon name="arrow" /></button>
        {file && <button className="text-button" onClick={() => onNext(false)}>사진 건너뛰기</button>}
      </div>

      {cameraVisible && (
        <div className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title">
          <div className="camera-dialog__header">
            <div><small>LIVE CAMERA</small><strong id="camera-title">눈 또는 손을 프레임에 맞춰주세요</strong></div>
            <button type="button" onClick={closeCamera} aria-label="카메라 닫기">×</button>
          </div>
          <div className="camera-viewfinder">
            <video ref={videoRef} autoPlay playsInline muted aria-label="카메라 미리보기" />
            <span className="camera-corner camera-corner--one"/>
            <span className="camera-corner camera-corner--two"/>
            <span className="camera-corner camera-corner--three"/>
            <span className="camera-corner camera-corner--four"/>
            {cameraState === "opening" && <div className="camera-loading" role="status">카메라 연결 중…</div>}
          </div>
          <p>원본은 서버로 전송되지 않으며 촬영 후 이 기기에서만 분석됩니다.</p>
          <div className="camera-controls">
            <button type="button" className="camera-cancel" onClick={closeCamera}>취소</button>
            <button type="button" className="camera-shutter" onClick={() => void capturePhoto()} disabled={cameraState !== "open" || isCapturing} aria-label="사진 촬영">
              <span/>
            </button>
            <span aria-hidden="true"/>
          </div>
        </div>
      )}
    </main>
  );
}

function AnalysisScreen({ step }: { step: number }) {
  const steps = [
    { label: "점수 궤도 계산", detail: "버전이 고정된 score-v1 규칙 엔진" },
    { label: "시각 신호 정리", detail: "허용된 색상과 대비 특징만 추출" },
    { label: "결과 안전하게 보관", detail: "비공개 계정 저장과 기기 캐시" },
    { label: "외계인 신분증 발급", detail: "최종 화면 렌더링 준비" },
  ];
  return (
    <main className="screen analysis-screen">
      <Brand inverse />
      <section className="analysis-visual" aria-hidden="true">
        <span className="scanner-ring scanner-ring--one"/><span className="scanner-ring scanner-ring--two"/><span className="scanner-ring scanner-ring--three"/>
        <div className="scanner-core"><span/><span/></div>
      </section>
      <section className="analysis-copy">
        <p className="eyebrow">ANALYZING SIGNALS</p>
        <h2>{step < 3 ? "당신의 출신 궤도를\n찾고 있습니다." : "신분증을 거의\n완성했습니다."}</h2>
        <div className="analysis-list" role="status" aria-live="polite">
          {steps.map((item, index) => (
            <div className={`${index < step ? "is-done" : ""} ${index === step ? "is-active" : ""}`} key={item.label}>
              <span className="analysis-status">{index < step ? <Icon name="check" size={14}/> : <i/>}</span>
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function ScoreCounter({ score }: { score: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setDisplay(score); return; }
    const start = performance.now();
    const duration = 1200;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(score * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  return <span aria-hidden="true">{display}</span>;
}

function Crest({ result }: { result: AlienResult }) {
  return (
    <div className="crest" style={{ "--crest-hue": result.accentHue } as React.CSSProperties} aria-label="당신의 은하 문장">
      <span className="crest__orbit"/><span className="crest__dot crest__dot--one"/><span className="crest__dot crest__dot--two"/>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 14C44 30 28 31 26 47c-2 17 12 28 24 39 12-11 26-22 24-39-2-16-18-17-24-33Z"/>
        <path d="M50 29v42M35 47c8 2 13 7 15 14M65 47c-8 2-13 7-15 14"/>
      </svg>
    </div>
  );
}

function ResultScreen({ result, onRestart, onShare, onDelete, shareState, deleteState, onUnlockAi, aiLoginState, aiLoginMessage }: {
  result: AlienResult;
  onRestart: () => void;
  onShare: () => void;
  onDelete: () => void;
  shareState: string;
  deleteState: string;
  onUnlockAi: () => void;
  aiLoginState: "idle" | "signing-in";
  aiLoginMessage: string | null;
}) {
  const portraitShift = result.accentHue - 210;
  const identityNumber = `${result.archetypeKey.slice(0, 2).toUpperCase()}-${String(result.score).padStart(2, "0")}-${String(result.confidence).padStart(2, "0")}`;
  return (
    <main className="screen result-screen" style={{ "--result-hue": result.accentHue, "--portrait-shift": `${portraitShift}deg` } as React.CSSProperties}>
      <div className="result-nav"><Brand inverse/><span className="confidence-chip"><span/> 신뢰도 {result.confidence}%</span></div>
      <section className="result-hero">
        <p className="eyebrow">ALIEN INDEX</p>
        <div className="score" aria-label={`외계인 지수 ${result.score}점, 100점 만점`}><ScoreCounter score={result.score}/><span aria-hidden="true">/ 100</span></div>
        <div className="grade"><span>{result.grade}</span><i/> <span>{result.archetype}형</span></div>
        <p>{result.oneLiner}</p>
      </section>

      <section className="identity-card">
        <div className="portrait-wrap">
          <Image src={result.generatedImageUrl ?? sitePath("/alien-portrait.png")} alt={`${result.archetype} 외계인 캐릭터`} width={1024} height={1536} priority unoptimized />
          <div className="portrait-tint"/>
          <span className="portrait-label">IDENTITY CONFIRMED <Icon name="check" size={13}/></span>
        </div>
        <div className="identity-details">
          <div><span>TYPE</span><strong>{result.archetype}</strong></div>
          <div><span>ORIGIN</span><strong>{result.origin}</strong></div>
          <div><span>IDENTITY NO.</span><strong>{identityNumber}</strong></div>
        </div>
      </section>

      {!result.generatedImageUrl && (
        <section className="ai-gate" aria-labelledby="ai-gate-title">
          <div className="ai-gate__copy">
            <p className="eyebrow">OPTIONAL AI ENHANCEMENT</p>
            <h2 id="ai-gate-title">AI 이미지와 해석을 보려면 로그인하세요</h2>
            <p>로그인하지 않아도 규칙 기반 점수와 신호 결과는 계속 볼 수 있어요. Google 로그인 후 이 화면에서 AI 결과를 다시 생성합니다.</p>
          </div>
          <button className="primary-button" onClick={onUnlockAi} disabled={aiLoginState === "signing-in"}>
            {aiLoginState === "signing-in" ? "AI 결과 준비 중…" : "Google로 로그인하고 AI 결과 보기"}
            {aiLoginState !== "signing-in" && <Icon name="arrow" />}
          </button>
          {aiLoginMessage && <p className="ai-gate__message" role="alert">{aiLoginMessage}</p>}
        </section>
      )}

      <section className="result-section">
        <div className="section-heading"><div><p className="eyebrow">TOP SIGNALS</p><h2>가장 강한 외계 신호</h2></div><span>TOP 3</span></div>
        <div className="signal-bars">
          {result.signals.map((signal, index) => (
            <div className="signal-bar" key={signal.label}>
              <div><span>0{index + 1}</span><strong>{signal.label}</strong><b>{signal.value}%</b></div>
              <div className="bar-track"><span style={{ width: `${signal.value}%` }}/></div>
              <p>{signal.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="earth-card">
        <div className="earth-icon">◎</div>
        <div><p className="eyebrow">EARTH ADAPTATION SKILL</p><h3>{result.earthSkill}</h3><p>{result.secondaryType}의 신호도 함께 감지됐어요.</p></div>
      </section>

      <section className="crest-section">
        <Crest result={result}/>
        <div><p className="eyebrow">GALACTIC CREST</p><h2>당신의 은하 문장</h2><p>신호의 방향과 주파수를 조합해 만든 고유 문양이에요.</p></div>
      </section>

      <section className="result-actions">
        <button className="result-share" onClick={onShare}><Icon name="share"/> {shareState}</button>
        <button className="result-restart" onClick={onRestart}><Icon name="refresh"/> 다시 감별하기</button>
        <button className="result-delete" onClick={onDelete}>{deleteState}</button>
        <p>공유에는 원본 사진이나 답변이 포함되지 않습니다.</p>
      </section>
    </main>
  );
}

export default function AlienIndexApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [gameChoice, setGameChoice] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoSignal, setPhotoSignal] = useState<PhotoSignal | null>(null);
  const [photoReading, setPhotoReading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState<AlienResult | null>(null);
  const [shareState, setShareState] = useState("결과 공유하기");
  const [deleteState, setDeleteState] = useState("내 데이터 삭제");
  const [aiLoginState, setAiLoginState] = useState<"idle" | "signing-in">("idle");
  const [aiLoginMessage, setAiLoginMessage] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<ScanDraft | null>(null);
  const [hasSavedResult, setHasSavedResult] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([scanRepository.getDraft(), scanRepository.latest()]).then(([draft, latest]) => {
      if (!active) return;
      setSavedDraft(draft);
      setHasSavedResult(Boolean(latest));
      setStorageReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady || !(["briefing", "quiz", "game", "photo"] as Screen[]).includes(screen)) return;
    const draft: ScanDraft = {
      updatedAt: new Date().toISOString(),
      screen: screen as ScanDraft["screen"],
      questionIndex,
      answers,
      gameChoice,
    };
    setSavedDraft(draft);
    void scanRepository.saveDraft(draft);
  }, [storageReady, screen, questionIndex, answers, gameChoice]);

  const reset = useCallback(() => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setScreen("home"); setQuestionIndex(0); setAnswers({}); setGameChoice(null);
    setPhotoFile(null); setPhotoPreview(null); setPhotoSignal(null); setPhotoError(null); setResult(null); setAnalysisStep(0);
    setAiLoginState("idle"); setAiLoginMessage(null);
    setSavedDraft(null);
    void scanRepository.clearDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [photoPreview]);

  const startFresh = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setQuestionIndex(0); setAnswers({}); setGameChoice(null);
    setPhotoFile(null); setPhotoPreview(null); setPhotoSignal(null); setPhotoError(null); setResult(null); setAnalysisStep(0);
    setAiLoginState("idle"); setAiLoginMessage(null);
    setSavedDraft(null);
    void scanRepository.clearDraft();
    setScreen("briefing");
  };

  const resumeDraft = () => {
    if (!savedDraft) return;
    setQuestionIndex(Math.min(savedDraft.questionIndex, questions.length - 1));
    setAnswers(savedDraft.answers);
    setGameChoice(savedDraft.gameChoice);
    setScreen(savedDraft.screen);
  };

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [screen]);

  const answerQuestion = (value: number) => {
    const question = questions[questionIndex];
    setAnswers((current) => ({ ...current, [question.id]: value }));
    window.setTimeout(() => {
      if (questionIndex < questions.length - 1) setQuestionIndex((current) => current + 1);
      else setScreen("game");
    }, 170);
  };

  const previousQuestion = () => {
    if (questionIndex > 0) setQuestionIndex((current) => current - 1);
    else setScreen("briefing");
  };

  const handlePhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhotoError("이미지 파일만 사용할 수 있어요.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setPhotoError("사진이 너무 커요. 12MB 이하 이미지를 선택해주세요.");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoReading(true);
    try { setPhotoSignal(await analyzePhoto(file)); }
    catch {
      setPhotoSignal(null);
      setPhotoError("시각 신호를 읽지 못했어요. 다른 사진을 선택하거나 건너뛸 수 있어요.");
    }
    finally { setPhotoReading(false); }
  };

  const beginAnalysis = useCallback(async (includePhoto = true) => {
    setScreen("analysis");
    setAnalysisStep(0);
    const minimumReveal = new Promise((resolve) => window.setTimeout(resolve, 850));

    const localResult = calculateResult(answers, gameChoice, includePhoto ? photoSignal : null);
    let nextResult = localResult;
    setAnalysisStep(1);

    const portrait = new window.Image();
    portrait.src = sitePath("/alien-portrait.png");
    try { await portrait.decode(); } catch { /* The result still has a CSS fallback background. */ }
    setAnalysisStep(2);

    if (gameChoice !== null) {
      try {
        const remoteScan = await runRemoteScan({
          answers,
          gameChoice,
          photoFile: includePhoto ? photoFile : null,
          onStatus: (status) => {
            if (status === "analyzing") setAnalysisStep(1);
            if (status === "generating") setAnalysisStep(2);
            if (status === "ready") setAnalysisStep(3);
          },
        });
        nextResult = remoteScan.result;
      } catch {
        // Firebase 또는 AI 작업이 실패해도 고정된 score-v1 로컬 엔진으로 결과를 제공합니다.
        nextResult = localResult;
      }
    }

    setResult(nextResult);
    await scanRepository.save({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), result: nextResult });
    setHasSavedResult(true);
    setAnalysisStep(3);

    await scanRepository.clearDraft();
    setSavedDraft(null);
    await document.fonts.ready;
    setAnalysisStep(4);
    await minimumReveal;
    setScreen("result");
  }, [answers, gameChoice, photoFile, photoSignal]);

  const unlockAi = useCallback(async () => {
    if (gameChoice === null || aiLoginState === "signing-in") return;
    setAiLoginState("signing-in");
    setAiLoginMessage(null);
    try {
      await signInWithGoogle();
      const remoteScan = await runRemoteScan({
        answers,
        gameChoice,
        photoFile,
        onStatus: (status) => {
          if (status === "generating") setAiLoginMessage("AI 이미지를 생성하고 있어요…");
          if (status === "ready") setAiLoginMessage(null);
        },
      });
      setResult(remoteScan.result);
      await scanRepository.save({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), result: remoteScan.result });
      if (!remoteScan.result.generatedImageUrl) {
        setAiLoginMessage("AI 결과를 준비하지 못해 규칙 기반 결과를 유지합니다. 잠시 후 다시 시도해주세요.");
      }
    } catch (error) {
      const code = String((error as { code?: string }).code ?? "");
      if (code.includes("resource-exhausted")) {
        setAiLoginMessage("오늘 빠른 감별 한도에 도달했습니다. 내일 다시 시도해주세요.");
      } else if (code.includes("unauthenticated")) {
        setAiLoginMessage("Google 로그인 세션이 만료됐습니다. 다시 로그인해주세요.");
      } else {
        setAiLoginMessage("Google 로그인 또는 AI 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setAiLoginState("idle");
    }
  }, [aiLoginState, answers, gameChoice, photoFile]);

  const restoreResult = async () => {
    const saved = await scanRepository.latest();
    if (!saved) return;
    let restoredResult = saved.result;
    try {
      const { auth } = getFirebaseServices();
      await auth.authStateReady();
      if (!auth.currentUser || auth.currentUser.isAnonymous) {
        const { generatedImageUrl: _generatedImageUrl, ...rulesOnlyResult } = restoredResult;
        restoredResult = rulesOnlyResult;
      }
    } catch {
      const { generatedImageUrl: _generatedImageUrl, ...rulesOnlyResult } = restoredResult;
      restoredResult = rulesOnlyResult;
    }
    setResult(restoredResult);
    setScreen("result");
  };

  const share = async () => {
    if (!result) return;
    const text = `나의 Alien Index는 ${result.score}! ${result.grade} · ${result.archetype}형으로 감지됐어요. 당신의 신호도 확인해보세요.`;
    try {
      if (navigator.share) await navigator.share({ title: "Alien Index 결과", text, url: window.location.href });
      else { await navigator.clipboard.writeText(`${text} ${window.location.href}`); setShareState("결과가 복사됐어요"); }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setShareState("공유를 다시 시도해주세요");
    }
  };

  const deleteData = async () => {
    if (!window.confirm("저장된 감별 결과와 비공개 사진, 공유 데이터를 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    setDeleteState("삭제 요청 중…");
    try {
      await requestRemoteDataDeletion();
      setDeleteState("삭제 요청 완료");
    } catch {
      setDeleteState("서버 삭제 재시도 필요");
    } finally {
      window.localStorage.removeItem("alien-index:last-scan");
      window.localStorage.removeItem("alien-index:scan-draft");
      setHasSavedResult(false);
    }
  };

  const current = useMemo(() => {
    if (screen === "home") return <HomeScreen onStart={startFresh} onRestore={restoreResult} onResume={resumeDraft} hasResult={hasSavedResult} draftProgress={draftProgress(savedDraft)}/>;
    if (screen === "briefing") return <BriefingScreen onBack={() => setScreen("home")} onStart={() => setScreen("quiz")}/>;
    if (screen === "quiz") return <QuizScreen index={questionIndex} answers={answers} onAnswer={answerQuestion} onBack={previousQuestion}/>;
    if (screen === "game") return <GameScreen selected={gameChoice} onSelect={setGameChoice} onBack={() => { setQuestionIndex(questions.length - 1); setScreen("quiz"); }} onNext={() => setScreen("photo")}/>;
    if (screen === "photo") return <PhotoScreen file={photoFile} preview={photoPreview} signal={photoSignal} isReading={photoReading} error={photoError} onFile={handlePhoto} onBack={() => setScreen("game")} onNext={beginAnalysis}/>;
    if (screen === "analysis") return <AnalysisScreen step={analysisStep}/>;
    if (screen === "result" && result) return <ResultScreen result={result} onRestart={reset} onShare={share} onDelete={deleteData} shareState={shareState} deleteState={deleteState} onUnlockAi={unlockAi} aiLoginState={aiLoginState} aiLoginMessage={aiLoginMessage}/>;
    return null;
  }, [screen, questionIndex, answers, gameChoice, photoFile, photoPreview, photoSignal, photoReading, photoError, analysisStep, result, shareState, deleteState, aiLoginState, aiLoginMessage, beginAnalysis, reset, unlockAi, hasSavedResult, savedDraft]);

  return <div className={`app-shell app-shell--${screen}`}>{current}</div>;
}
