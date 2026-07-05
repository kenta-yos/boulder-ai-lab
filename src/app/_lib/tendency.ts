// 過去の解析スコアから「登り手の傾向（弱い軸・改善/低下）」を短くまとめる。
// これをAIに背景として渡し、今回の映像診断を主役にしつつ再発/改善/次の一手に使わせる。
import { SKILLS, type SkillScore } from "./analyze";

// past は「新しい→古い順」の解析（scoresを含む）を想定。
// 傾向を語れるだけの回数が無ければ undefined（無理に語らせない）。
export function buildTrendSummary(
  past: { scores: unknown }[],
): string | undefined {
  const rows = past
    .map((p) =>
      Array.isArray(p.scores) ? (p.scores as unknown as SkillScore[]) : null,
    )
    .filter((s): s is SkillScore[] => !!s && s.length > 0);
  if (rows.length < 3) return undefined; // 最低3回はないと傾向と言えない

  // 古い→新しい順に直して軸ごとに点数を集める
  const chrono = [...rows].reverse();
  const perAxis: Record<string, number[]> = {};
  for (const skill of SKILLS) perAxis[skill] = [];
  for (const row of chrono) {
    for (const s of row) {
      if (perAxis[s.skill] && typeof s.score === "number") {
        perAxis[s.skill].push(s.score);
      }
    }
  }

  const avg = (a: number[]) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

  const stats = SKILLS.map((skill) => ({
    skill,
    values: perAxis[skill],
    mean: avg(perAxis[skill]),
  })).filter((s) => s.values.length >= 2 && !Number.isNaN(s.mean));
  if (stats.length === 0) return undefined;

  // 弱い順（平均が低い順）に上位3軸
  const weak = [...stats].sort((a, b) => a.mean - b.mean).slice(0, 3);

  // 直近が上がっているか下がっているか（データが足りなければ触れない）
  const trendWord = (values: number[]) => {
    if (values.length < 4) return "";
    const half = Math.floor(values.length / 2);
    const older = avg(values.slice(0, half));
    const newer = avg(values.slice(half));
    const d = newer - older;
    if (d >= 5) return "（直近やや改善）";
    if (d <= -5) return "（直近やや低下）";
    return "（横ばい）";
  };

  const parts = weak.map(
    (w) => `${w.skill}${Math.round(w.mean)}${trendWord(w.values)}`,
  );
  return `これまで${chrono.length}回ぶんの傾向（100が理想の相対評価）。弱い順：${parts.join("、")}。`;
}
