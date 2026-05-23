"use client";

import type { SleepBalanceAdvice, FrequencyStatRow } from "@/lib/sleepBalanceAdvice";
import { buildSleepBalanceAdvice } from "@/lib/sleepBalanceAdvice";
import type { SleepLogRow } from "@/lib/fetchSleepLogChartData";
import { buildPreviewRows } from "@/lib/sleepStats";
import { useMemo } from "react";

const ACCENT = "#DEFF9A";
const CHART_MAX = 5;

type Props = {
  rows: SleepLogRow[];
  /** 未ログイン時のプレビュー */
  preview?: boolean;
};

function MindBodyBalanceBars({
  mind,
  body,
  label,
}: {
  mind: number;
  body: number;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-center text-xs text-violet-200/80">{label}</p>
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-slate-500">
            <span>心（意識・感情）</span>
            <span className="tabular-nums text-slate-400">{mind}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all"
              style={{ width: `${mind}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-slate-500">
            <span>体（休息・回復）</span>
            <span className="tabular-nums text-slate-400">{body}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${body}%`,
                background: `linear-gradient(90deg, #4ade80, ${ACCENT})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FrequencyScoreChart({
  bars,
}: {
  bars: { label: string; avgScore: number; playCount: number }[];
}) {
  const ticks = [5, 4, 3, 2, 1, 0];

  return (
    <div
      className="flex h-48 w-full flex-col"
      role="img"
      aria-label="周波数別の平均スッキリ度"
    >
      <div className="relative flex min-h-0 flex-1">
        <div className="flex w-6 shrink-0 flex-col justify-between text-[9px] tabular-nums text-slate-500">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="absolute inset-0 bottom-8 flex flex-col justify-between">
            {ticks.map((t) => (
              <div
                key={t}
                className="border-t border-dashed border-slate-700/40"
              />
            ))}
          </div>
          <div className="relative z-10 flex h-full items-end justify-between gap-2 border-b border-slate-600/50 px-1 pb-8">
            {bars.map((b) => {
              const pct = Math.min(100, (b.avgScore / CHART_MAX) * 100);
              const short = b.label.replace(" Hz", "").replace(" Noise", "");
              return (
                <div
                  key={b.label}
                  className="flex min-w-0 flex-1 flex-col items-center"
                  title={`${b.label}: ${b.avgScore}（${b.playCount}回）`}
                >
                  <div className="flex h-[120px] w-full max-w-[2.5rem] items-end justify-center">
                    <div
                      className="w-[70%] rounded-t-md bg-gradient-to-t from-violet-600 to-[#DEFF9A]"
                      style={{ height: `${Math.max(pct, 8)}%` }}
                    />
                  </div>
                  <span className="mt-1.5 w-full truncate text-center text-[9px] text-slate-400">
                    {short}
                  </span>
                  <span className="text-[9px] tabular-nums text-[#DEFF9A]/90">
                    {b.avgScore}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function FrequencyTable({ rows }: { rows: FrequencyStatRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full min-w-[280px] text-left text-xs">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03] text-slate-500">
            <th className="px-3 py-2 font-medium">周波数</th>
            <th className="px-3 py-2 font-medium">回数</th>
            <th className="px-3 py-2 font-medium">スッキリ度</th>
            <th className="px-3 py-2 font-medium">心</th>
            <th className="px-3 py-2 font-medium">体</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">
              テーマ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.soundId}
              className="border-b border-white/[0.04] text-slate-300 last:border-0"
            >
              <td className="px-3 py-2.5 font-medium text-white">{r.label}</td>
              <td className="px-3 py-2.5 tabular-nums">{r.playCount}</td>
              <td className="px-3 py-2.5 tabular-nums text-[#DEFF9A]">
                {r.avgScore.toFixed(1)}
              </td>
              <td className="px-3 py-2.5 tabular-nums">{r.mind}</td>
              <td className="px-3 py-2.5 tabular-nums">{r.body}</td>
              <td className="hidden px-3 py-2.5 text-slate-500 sm:table-cell">
                {r.theme}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendBadge({ advice }: { advice: SleepBalanceAdvice }) {
  const colors =
    advice.trend === "improving"
      ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
      : advice.trend === "declining"
        ? "border-amber-500/30 bg-amber-950/30 text-amber-200"
        : "border-violet-500/30 bg-violet-950/30 text-violet-200";

  return (
    <div className={`rounded-xl border px-4 py-3 ${colors}`}>
      <p className="text-sm font-semibold">{advice.trendLabel}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-90">
        {advice.trendDetail}
      </p>
    </div>
  );
}

export function SleepBalanceAdvicePanel({ rows, preview }: Props) {
  const advice = useMemo(() => {
    const data = preview ? buildPreviewRows() : rows;
    return buildSleepBalanceAdvice(data);
  }, [rows, preview]);

  if (!advice) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#030712] p-5 text-center text-sm text-slate-400">
        セッションを記録すると、心と体のバランス分析が表示されます。
      </section>
    );
  }

  return (
    <section
      className="space-y-5 rounded-2xl border border-[#DEFF9A]/15 bg-gradient-to-b from-violet-950/25 to-[#030712] p-4 sm:p-5"
      aria-labelledby="balance-advice-heading"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#DEFF9A]/70">
          ✦ 新機能
        </p>
        <h3
          id="balance-advice-heading"
          className="mt-1 text-base font-semibold text-white sm:text-lg"
        >
          心と体のバランス分析
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          履歴から傾向を読み取り、合う周波数を提案します
        </p>
      </div>

      <TrendBadge advice={advice} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <MindBodyBalanceBars
            mind={advice.mindIndex}
            body={advice.bodyIndex}
            label={advice.balanceLabel}
          />
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="mb-3 text-xs font-medium text-slate-500">
            周波数別 · 平均スッキリ度
          </p>
          {advice.chartBars.length > 0 ? (
            <FrequencyScoreChart bars={advice.chartBars} />
          ) : (
            <p className="text-xs text-slate-500">データ不足</p>
          )}
        </div>
      </div>

      {advice.frequencyTable.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">
            聴取履歴と心・体への働き
          </p>
          <FrequencyTable rows={advice.frequencyTable} />
        </div>
      ) : null}

      <ul className="space-y-2 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
        <p className="text-xs font-medium text-violet-200/90">傾向メモ</p>
        {advice.insights.map((line) => (
          <li
            key={line}
            className="flex gap-2 text-xs leading-relaxed text-slate-400"
          >
            <span className="text-[#DEFF9A]" aria-hidden>
              ·
            </span>
            {line}
          </li>
        ))}
      </ul>

      {advice.recommendation ? (
        <div
          className="rounded-2xl border border-[#DEFF9A]/25 px-4 py-4 sm:px-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(222,255,154,0.06))",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#DEFF9A]/80">
            おすすめの周波数
          </p>
          <p className="mt-2 text-xl font-bold text-white">
            {advice.recommendation.label}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {advice.recommendation.reason}
          </p>
          <p className="mt-3 rounded-lg bg-black/25 px-3 py-2 text-xs leading-relaxed text-slate-400">
            {advice.recommendation.tip}
          </p>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            この分析の
            <strong className="font-medium text-slate-400">下</strong>
            にある再生パネル（
            <a
              href="#sound-library"
              className="text-violet-300/90 underline-offset-2 hover:text-violet-200 hover:underline"
            >
              Sound Library
            </a>
            ）で、カードに表示されている「
            <span className="font-medium text-slate-400">
              {advice.recommendation.label}
            </span>
            」をタップし、再生ボタンを押して聴き始めてください。
          </p>
        </div>
      ) : null}
    </section>
  );
}
