// 技術8軸の点数の推移を、軸ごとに小さな折れ線(スパークライン)で表示する部品。
// サーバー/クライアント両方で使える純粋な描画。
import { SKILLS } from "../_lib/analyze";

export type AxisSeries = {
  skill: string;
  points: number[]; // 古い→新しい順の点数（0〜100）
};

function color(v: number): string {
  if (v < 40) return "#ef4444";
  if (v < 70) return "#f59e0b";
  return "#16a34a";
}

function Sparkline({ points }: { points: number[] }) {
  const W = 120;
  const H = 28;
  const pad = 3;
  if (points.length === 0) {
    return <span className="text-xs text-zinc-400">データなし</span>;
  }
  const n = points.length;
  const x = (i: number) =>
    n === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1);
  const y = (v: number) => H - pad - (Math.max(0, Math.min(100, v)) / 100) * (H - pad * 2);
  const last = points[n - 1];

  return (
    <svg width={W} height={H} className="overflow-visible">
      {/* 折れ線 */}
      {n >= 2 && (
        <polyline
          points={points.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
          fill="none"
          stroke={color(last)}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {/* 最新点 */}
      <circle cx={x(n - 1)} cy={y(last)} r={3} fill={color(last)} />
    </svg>
  );
}

export function TrendSparklines({ series }: { series: AxisSeries[] }) {
  const byName = new Map(series.map((s) => [s.skill, s]));
  return (
    <div className="space-y-2">
      {SKILLS.map((skill) => {
        const s = byName.get(skill);
        const points = s?.points ?? [];
        const last = points.length ? points[points.length - 1] : null;
        return (
          <div
            key={skill}
            className="flex items-center justify-between gap-3"
          >
            <span className="w-28 shrink-0 text-sm">{skill}</span>
            <div className="flex-1">
              <Sparkline points={points} />
            </div>
            <span className="w-8 shrink-0 text-right text-sm text-zinc-500 dark:text-zinc-400">
              {last ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
