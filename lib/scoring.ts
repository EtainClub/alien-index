export type Axis = "pattern" | "dream" | "signal" | "observer" | "shape" | "diplomacy";

export type Question = {
  id: string;
  eyebrow: string;
  text: string;
  hint: string;
  axis: Axis;
};

export type PhotoSignal = {
  score: number;
  confidence: number;
  dominantHue: number;
  contrast: number;
  qualityLabel: string;
};

export type AlienResult = {
  score: number;
  confidence: number;
  grade: string;
  archetype: string;
  archetypeKey: Axis;
  secondaryType: string;
  oneLiner: string;
  earthSkill: string;
  origin: string;
  signals: Array<{ label: string; value: number; detail: string }>;
  accentHue: number;
};

export const questions: Question[] = [
  {
    id: "hidden-links",
    eyebrow: "사고 궤도",
    text: "서로 상관없어 보이는 것들 사이에서 연결점을 자주 발견한다.",
    hint: "일상의 사물, 말, 아이디어를 떠올려보세요.",
    axis: "pattern",
  },
  {
    id: "dream-places",
    eyebrow: "꿈의 좌표",
    text: "꿈속에 현실에는 없는 도시나 장소가 선명하게 등장한다.",
    hint: "최근의 꿈뿐 아니라 오래 기억나는 꿈도 포함해요.",
    axis: "dream",
  },
  {
    id: "small-signals",
    eyebrow: "신호 감도",
    text: "빛, 소리, 질감의 작은 변화가 다른 사람보다 먼저 느껴진다.",
    hint: "좋고 나쁨이 아니라 감지 범위를 묻는 질문이에요.",
    axis: "signal",
  },
  {
    id: "watch-first",
    eyebrow: "지구 적응",
    text: "새로운 집단에 가면 참여하기 전에 전체 분위기부터 관찰한다.",
    hint: "낯선 모임에 처음 도착한 순간을 떠올려보세요.",
    axis: "observer",
  },
  {
    id: "new-angle",
    eyebrow: "사고 궤도",
    text: "정답을 찾는 것보다 전혀 다른 관점으로 다시 보는 일이 더 재미있다.",
    hint: "평소 문제를 풀 때의 방식에 가까운 답을 골라주세요.",
    axis: "shape",
  },
  {
    id: "vivid-world",
    eyebrow: "꿈의 좌표",
    text: "상상 속 세계가 실제 장소처럼 색과 분위기를 갖고 느껴질 때가 있다.",
    hint: "공상, 글쓰기, 그림 같은 상상도 모두 포함해요.",
    axis: "dream",
  },
  {
    id: "unspoken-rules",
    eyebrow: "사고 궤도",
    text: "설명을 듣기 전에 시스템의 숨은 규칙을 먼저 알아차리는 편이다.",
    hint: "게임, 앱, 사람들의 행동 패턴을 생각해보세요.",
    axis: "pattern",
  },
  {
    id: "atmosphere",
    eyebrow: "신호 감도",
    text: "어떤 장소에 들어서면 말로 설명하기 전부터 분위기가 다르게 느껴진다.",
    hint: "공간이 주는 첫인상에 관한 질문이에요.",
    axis: "signal",
  },
  {
    id: "solo-flow",
    eyebrow: "지구 적응",
    text: "혼자 있을 때 생각이 더 자유롭고 멀리 뻗어 나간다.",
    hint: "에너지를 충전하는 방식에는 정답이 없어요.",
    axis: "observer",
  },
  {
    id: "odd-customs",
    eyebrow: "지구 문화",
    text: "모두가 당연하게 여기는 관습이 가끔은 아주 낯설게 느껴진다.",
    hint: "평범한 일상을 한 발짝 밖에서 보는 감각이에요.",
    axis: "shape",
  },
  {
    id: "first-contact",
    eyebrow: "첫 접촉",
    text: "낯선 존재를 만나면 두려움보다 그들의 언어와 문화를 알고 싶어진다.",
    hint: "호기심이 먼저인지, 안전한 거리가 먼저인지 골라보세요.",
    axis: "diplomacy",
  },
  {
    id: "translate",
    eyebrow: "지구 외교",
    text: "생각이 다른 두 사람 사이에서 서로의 말을 번역해 주는 역할을 자주 한다.",
    hint: "의견을 같게 만드는 것보다 이해를 돕는 능력을 말해요.",
    axis: "diplomacy",
  },
];

const archetypes: Record<Axis, { name: string; detail: string; earth: string; origin: string }> = {
  pattern: {
    name: "패턴 항해자",
    detail: "보이지 않는 연결을 따라 가장 먼저 항로를 발견합니다.",
    earth: "복잡한 상황을 빠르게 구조화하는 능력",
    origin: "격자 성운 · N-17",
  },
  dream: {
    name: "꿈의 지도 제작자",
    detail: "아직 이름 없는 세계에 좌표와 이야기를 부여합니다.",
    earth: "가능성을 생생한 장면으로 바꾸는 능력",
    origin: "청람 위성 · Luma",
  },
  signal: {
    name: "신호 수집가",
    detail: "빛과 소리 사이의 미세한 지구 신호까지 포착합니다.",
    earth: "변화를 섬세하게 감지하는 고감도 수신력",
    origin: "이온 해양 · C-64",
  },
  observer: {
    name: "조용한 관찰자",
    detail: "서두르지 않고 전체 궤도를 읽은 뒤 움직입니다.",
    earth: "한 걸음 떨어져 흐름을 정확히 보는 능력",
    origin: "심우주 관측소 · O-9",
  },
  shape: {
    name: "형태 탐험가",
    detail: "정해진 모양을 벗어나 새로운 조합을 즐깁니다.",
    earth: "익숙한 문제를 낯선 방식으로 다시 만드는 능력",
    origin: "변형 행성 · M-22",
  },
  diplomacy: {
    name: "지구 외교관",
    detail: "낯선 신호와 지구의 언어 사이에 다리를 놓습니다.",
    earth: "서로 다른 관점을 부드럽게 연결하는 능력",
    origin: "중립 궤도 · Terra-2",
  },
};

const signalCopy: Record<Axis, string> = {
  pattern: "숨은 규칙을 항로처럼 읽어요",
  dream: "상상에 선명한 좌표를 부여해요",
  signal: "미세한 변화를 빠르게 포착해요",
  observer: "전체 흐름을 먼저 스캔해요",
  shape: "새로운 형태와 조합을 만들어요",
  diplomacy: "서로 다른 신호를 번역해요",
};

export function calculateResult(
  answers: Record<string, number>,
  gameChoice: number | null,
  photoSignal: PhotoSignal | null,
): AlienResult {
  const buckets: Record<Axis, number[]> = {
    pattern: [], dream: [], signal: [], observer: [], shape: [], diplomacy: [],
  };

  questions.forEach((question) => {
    const answer = answers[question.id];
    if (answer !== undefined) buckets[question.axis].push((answer / 4) * 100);
  });

  const axisScores = Object.fromEntries(
    Object.entries(buckets).map(([axis, values]) => [
      axis,
      values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 50,
    ]),
  ) as Record<Axis, number>;

  const questionScore = Math.round(
    Object.values(axisScores).reduce((sum, value) => sum + value, 0) / Object.keys(axisScores).length,
  );
  const gameScores = [62, 94, 76, 84];
  const modules = [
    { score: questionScore, weight: 0.6, confidence: Object.keys(answers).length / questions.length },
    ...(gameChoice === null ? [] : [{ score: gameScores[gameChoice], weight: 0.25, confidence: 1 }]),
    ...(photoSignal ? [{ score: photoSignal.score, weight: 0.15, confidence: photoSignal.confidence }] : []),
  ];
  const weighted = modules.reduce((sum, module) => sum + module.score * module.weight * module.confidence, 0);
  const denominator = modules.reduce((sum, module) => sum + module.weight * module.confidence, 0);
  const rawScore = denominator ? Math.round(weighted / denominator) : questionScore;
  const score = Math.max(8, Math.min(98, rawScore));
  const completion = 0.7 + (gameChoice !== null ? 0.18 : 0) + (photoSignal ? 0.12 * photoSignal.confidence : 0);
  const confidence = Math.round(Math.min(0.98, completion) * 100);
  const sortedAxes = (Object.entries(axisScores) as Array<[Axis, number]>).sort((a, b) => b[1] - a[1]);
  const [primary, secondary] = sortedAxes;
  const archetype = archetypes[primary[0]];

  const grade = score < 20 ? "정통 지구인"
    : score < 40 ? "달 근처 거주자"
    : score < 60 ? "궤도 여행자"
    : score < 80 ? "심우주 교환학생"
    : score < 95 ? "은하 시민"
    : "외계 문명 대사";

  const oneLiner = score < 40
    ? "지구 환경에 놀라울 만큼 잘 맞지만, 가끔 낯선 주파수로 생각합니다."
    : score < 70
      ? "지구의 일상 속에서도 자기만의 궤도를 잃지 않는 여행자입니다."
      : "평범한 장면에서도 먼 은하의 신호를 발견하는 존재입니다.";

  return {
    score,
    confidence,
    grade,
    archetype: archetype.name,
    archetypeKey: primary[0],
    secondaryType: archetypes[secondary[0]].name,
    oneLiner,
    earthSkill: archetype.earth,
    origin: archetype.origin,
    signals: sortedAxes.slice(0, 3).map(([axis, value]) => ({
      label: archetypes[axis].name,
      value,
      detail: signalCopy[axis],
    })),
    accentHue: photoSignal?.dominantHue ?? ({ pattern: 190, dream: 250, signal: 170, observer: 210, shape: 285, diplomacy: 70 }[primary[0]]),
  };
}
