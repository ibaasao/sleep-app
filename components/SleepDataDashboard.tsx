"use client";

import type { SleepLogChartPoint } from "@/lib/fetchSleepLogChartData";
import {
  buildSleepStats,
  formatDurationJa,
  formatWakeScoreAvg,
  previewSleepLogChartData,
  previewSleepStats,
  type SleepStatsBundle,
} from "@/lib/sleepStats";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useSleepLogChartData } from "@/hooks/useSleepLogChartData";
import Link from "next/link";
import { useMemo } from "react";

const ACCENT_LIME = "#DEFF9A";
const SURFACE = "#030712";
const CHART_MAX = 5;

type Props = {
  isLoggedIn: boolean;
};

function chartPointsToBars(data: SleepLogChartPoint[]) {
  return data.map((d) => ({
    label: d.date,
    wake_score: d.score ?? 0,
    hasData: d.hasData,
  }));
}

function WakeScoreBarChart({ data }: { data: SleepLogChartPoint[] }) {
  const bars = chartPointsToBars(data);
  const plotH = 168;
  const padL = 32;
  const padB = 32;
  const padT = 12;
  const barGap = 8;
  const width = 360;

  return (
    <svg
      viewBox={`0 0 ${width} ${plotH + padB + padT}`}
      className="h-full w-full"
      role="img"
      aria-label="過去7日間の目覚めのスッキリ度"
    >
      <defs>
        <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="100%" stopColor={ACCENT_LIME} />
        </linearGradient>
        <linearGradient id="barGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#DEFF9A" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c084fc" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {[0, 1, 2, 3, 4, 5].map((tick) => {
        const y = padT + plotH - (tick / CHART_MAX) * plotH;
        return (
          <g key={tick}>
            <line
              x1={padL}
              x2={width - 12}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.12)"
              strokeDasharray="4 4"
            />
            <text
              x={padL - 8}
              y={y + 4}
              textAnchor="end"
              fill="#64748b"
              fontSize={10}
            >
              {tick}
            </text>
          </g>
        );
      })}

      {bars.map((point, i) => {
        const n = bars.length || 1;
        const innerW = width - padL - 16;
        const slotW = innerW / n;
        const barW = Math.min(36, slotW - barGap);
        const cx = padL + slotW * i + slotW / 2;
        const h = point.hasData
          ? (point.wake_score / CHART_MAX) * plotH
          : 0;
        const x = cx - barW / 2;
        const y = padT + plotH - h;

        return (
          <g key={point.label}>
            {point.hasData ? (
              <rect
                x={x - 2}
                y={y - 2}
                width={barW + 4}
                height={Math.max(h + 4, 4)}
                rx={6}
                fill="url(#barGlow)"
              />
            ) : null}
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, point.hasData ? 3 : 0)}
              rx={5}
              fill={point.hasData ? "url(#barGrad)" : "rgba(51,65,85,0.5)"}
            >
              <title>
                {point.hasData
                  ? `${point.label}: ${point.wake_score.toFixed(1)} / 5`
                  : `${point.label}: 記録なし`}
              </title>
            </rect>
            <text
              x={cx}
              y={padT + plotH + 20}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={10}
            >
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SummaryCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm transition hover:border-violet-500/25 hover:bg-white/[0.06]">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p
        className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-white"
        style={{ textShadow: `0 0 24px ${ACCENT_LIME}33` }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      ) : null}
    </div>
  );
}

function DashboardBody({
  stats,
  chartData,
  loading,
  error,
  isEmpty,
}: {
  stats: SleepStatsBundle;
  chartData: SleepLogChartPoint[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
}) {
  const { summary } = stats;
  const hasAnyChartData = chartData.some((d) => d.hasData);

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-xl border border-red-400/20 bg-red-950/30 px-3 py-2 text-center text-sm text-red-300/90">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-center text-sm text-slate-500">読み込み中…</p>
      ) : null}
      {!loading && !error && isEmpty ? (
        <div
          className="rounded-2xl border border-violet-500/20 bg-violet-950/20 px-4 py-4 text-center"
          style={{ borderColor: `${ACCENT_LIME}22` }}
        >
          <p className="text-sm font-medium text-white">
            まだ睡眠ログがありません
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            上のサウンドでセッションを再生すると、再生開始が記録されます。
            新しい形式（再生時間・スッキリ度）のログは、セッション終了時の保存機能を有効にすると表示されます。
          </p>
        </div>
      ) : null}
      {!loading && !error && !isEmpty && !hasAnyChartData ? (
        <p className="text-center text-xs text-slate-500">
          過去7日間の記録はありません（今週のサマリーのみ表示）
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          title="今週の合計再生時間"
          value={formatDurationJa(summary.weekTotalDurationSec)}
        />
        <SummaryCard
          title="よく聴く周波数"
          value={summary.topSoundLabel}
          sub={summary.topSoundId ? undefined : "今週の記録なし"}
        />
        <SummaryCard
          title="平均スコア"
          value={formatWakeScoreAvg(summary.avgWakeScore)}
          sub="目覚めのスッキリ度 · 今週"
        />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(124,58,237,0.18),transparent_55%)]"
          aria-hidden
        />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
            7-day trend
          </p>
          <h3 className="mt-1 bg-gradient-to-r from-violet-200 via-fuchsia-200 to-[#DEFF9A] bg-clip-text text-base font-semibold text-transparent">
            目覚めのスッキリ度（1〜5）
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            過去7日間 · 日ごとの平均スコア
          </p>
          <div className="mt-4 h-52 w-full min-w-0 sm:h-60">
            <WakeScoreBarChart data={chartData} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ログインユーザー向け 睡眠データ分析ダッシュボード（マイページ）
 */
export function SleepDataDashboard({ isLoggedIn: serverLoggedIn }: Props) {
  const { loggedIn, authReady } = useClientAuth(serverLoggedIn);
  const { chartData, rows, loading, error, warning, refetch } =
    useSleepLogChartData(loggedIn && authReady);

  const preview = useMemo(() => previewSleepStats(), []);
  const previewChart = useMemo(() => previewSleepLogChartData(), []);

  const loggedInStats = useMemo(
    () => buildSleepStats(rows),
    [rows],
  );

  const displayStats = loggedIn ? loggedInStats : preview;
  const displayChartData = loggedIn ? chartData : previewChart;
  const isEmpty = loggedIn && !loading && rows.length === 0;

  const displayError =
    loggedIn && (error || warning)
      ? (error ?? warning)
      : null;

  return (
    <section
      className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/[0.06] p-5 shadow-[0_0_60px_-24px_rgba(124,58,237,0.45)] sm:p-6"
      style={{ backgroundColor: SURFACE }}
      aria-labelledby="sleep-data-dashboard-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(88,28,135,0.22),transparent_50%)]"
        aria-hidden
      />

      <header className="relative mb-6 text-center sm:text-left">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">
          my page
        </p>
        <h2
          id="sleep-data-dashboard-heading"
          className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl"
        >
          睡眠データ分析
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          再生ログから、週間サマリーとスッキリ度の推移を確認できます。
        </p>
      </header>

      <div className="relative min-h-[280px]">
        <div
          className={
            loggedIn
              ? "relative"
              : "pointer-events-none select-none blur-sm brightness-90"
          }
          aria-hidden={!loggedIn}
        >
          <DashboardBody
            stats={displayStats}
            chartData={displayChartData}
            loading={loggedIn && (!authReady || loading)}
            error={loggedIn ? displayError : null}
            isEmpty={isEmpty}
          />
          {loggedIn && !loading && authReady ? (
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 w-full rounded-xl border border-white/10 py-2 text-xs text-slate-400 transition hover:border-violet-500/30 hover:text-slate-200"
            >
              データを再読み込み
            </button>
          ) : null}
        </div>

        {!loggedIn ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center backdrop-blur-sm">
            <p className="max-w-xs text-base font-medium leading-relaxed text-white sm:text-lg">
              🔑 ログインして睡眠分析を解放
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              再生時間・音源・目覚めスコアを記録すると、マイページで週間データと7日間のグラフが表示されます。
            </p>
            <Link
              href="/login"
              className="rounded-full border border-slate-600 bg-slate-800/90 px-5 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 transition hover:border-slate-500 hover:bg-slate-700/90"
            >
              ログイン
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** @deprecated SleepDataDashboard の isLoggedIn を使用してください */
export function SleepStatsDashboard({
  loggedIn,
}: {
  loggedIn: boolean;
}) {
  return <SleepDataDashboard isLoggedIn={loggedIn} />;
}
