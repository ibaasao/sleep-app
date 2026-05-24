"use client";

import type {
  SleepLogChartPoint,
  SleepLogRow,
} from "@/lib/fetchSleepLogChartData";
import {
  buildSleepStats,
  formatDurationJa,
  formatWakeScoreAvg,
  previewSleepLogChartData,
  previewSleepStats,
  wakeScoreFilledStars,
  type SleepStatsBundle,
  type SleepStatsSummary,
} from "@/lib/sleepStats";
import { SleepBalanceAdvicePanel } from "@/components/SleepBalanceAdvicePanel";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useSleepLogChartData } from "@/hooks/useSleepLogChartData";
import { buildPreviewRows } from "@/lib/sleepStats";
import Link from "next/link";
import { useMemo } from "react";

const ACCENT_LIME = "#DEFF9A";
const SURFACE = "#030712";
const CHART_MAX = 5;

type Props = {
  isLoggedIn: boolean;
};

function WakeScoreBarChart({ data }: { data: SleepLogChartPoint[] }) {
  const ticks = [5, 4, 3, 2, 1, 0];

  return (
    <div
      className="flex h-56 w-full flex-col sm:h-60"
      role="img"
      aria-label="過去7日間の目覚めのスッキリ度"
    >
      <div className="relative flex min-h-0 flex-1">
        <div className="flex w-7 shrink-0 flex-col justify-between py-0.5 text-[10px] tabular-nums text-slate-500">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="absolute inset-0 bottom-6 flex flex-col justify-between">
            {ticks.map((t) => (
              <div
                key={t}
                className="border-t border-dashed border-slate-700/40"
              />
            ))}
          </div>
          <div className="relative z-10 flex h-full items-end justify-between gap-1.5 border-b border-slate-600/50 px-1 pb-6 sm:gap-2">
            {data.map((point) => {
              const pct = point.hasData
                ? Math.min(100, ((point.score ?? 0) / CHART_MAX) * 100)
                : 0;
              return (
                <div
                  key={point.dateKey}
                  className="flex min-w-0 flex-1 flex-col items-center"
                  title={
                    point.hasData
                      ? `${point.date}: ${point.score?.toFixed(1)} / 5`
                      : `${point.date}: 記録なし`
                  }
                >
                  <div className="flex h-[148px] w-full max-w-[2.25rem] items-end justify-center sm:max-w-[2.75rem]">
                    <div
                      className={`w-[72%] max-w-[2rem] rounded-t-md transition-all ${
                        point.hasData
                          ? "bg-gradient-to-t from-violet-600 via-fuchsia-500 to-[#DEFF9A] shadow-[0_0_12px_-2px_rgba(222,255,154,0.35)]"
                          : "border border-dashed border-slate-600/60 bg-slate-800/40"
                      }`}
                      style={{
                        height: point.hasData
                          ? `${Math.max(pct, 6)}%`
                          : "4px",
                      }}
                    />
                  </div>
                  <span className="mt-2 w-full truncate text-center text-[10px] text-slate-400 sm:text-[11px]">
                    {point.date}
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

function WakeScoreStars({ score }: { score: number | null }) {
  const filled = wakeScoreFilledStars(score);
  if (score == null || !Number.isFinite(score)) {
    return <span className="text-slate-500">—</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 text-lg leading-none"
      aria-label={`スッキリ度 ${score.toFixed(1)} / 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= filled ? "text-[#DEFF9A]" : "text-slate-600"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function HeroSummaryCard({ summary }: { summary: SleepStatsSummary }) {
  const sessions = summary.weekSessionCount;
  const sessionLabel =
    sessions > 0 ? `今週、${sessions}回のセッション` : "今週のセッションはまだありません";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/50 via-[#030712] to-fuchsia-950/30 px-5 py-5 sm:px-6 sm:py-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(167,139,250,0.2),transparent_55%)]"
        aria-hidden
      />
      <div className="relative space-y-3">
        <p className="text-xs font-medium text-violet-200/90">
          今週のサマリー（月曜〜今日）
        </p>
        <p className="text-lg font-semibold text-white sm:text-xl">
          {sessionLabel}
        </p>
        <p
          className="text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl"
          style={{ textShadow: `0 0 32px ${ACCENT_LIME}44` }}
        >
          合計 {formatDurationJa(summary.weekTotalDurationSec)}
          <span className="ml-2 text-sm font-normal text-slate-400">
            （タイマー設定）
          </span>
        </p>
        <p className="text-sm text-slate-300">
          よく聴いた音:{" "}
          <span className="font-semibold text-white">
            {summary.topSoundLabel}
          </span>
        </p>
        <p className="text-[11px] leading-relaxed text-slate-500">
          ※ 再生時間はオフタイマーで選んだ時間の合計です（実際に聴いた時間ではありません）
        </p>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 backdrop-blur-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <div className="mt-3">{children}</div>
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
      {!loading && !error && !isEmpty ? (
        <>
          <HeroSummaryCard summary={summary} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailCard title="スッキリ度">
              <div className="flex flex-wrap items-center gap-3">
                <WakeScoreStars score={summary.avgWakeScore} />
                <span className="text-xl font-semibold tabular-nums text-white">
                  {formatWakeScoreAvg(summary.avgWakeScore)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                目覚めのスッキリ度 · 今週の平均
              </p>
            </DetailCard>

            <DetailCard title="よく聴く音">
              <p className="text-xl font-semibold text-white">
                {summary.topSoundLabel}
                {summary.topSoundPlayCount > 0 ? (
                  <span className="ml-2 text-base font-normal text-slate-400">
                    ({summary.topSoundPlayCount}回)
                  </span>
                ) : null}
              </p>
              <p className="mt-2 text-xs text-slate-500">今週いちばん多く再生した音源</p>
            </DetailCard>
          </div>
        </>
      ) : null}

      {!loading && !error && !isEmpty && !hasAnyChartData ? (
        <p className="text-center text-xs text-slate-500">
          過去7日間の記録はありません（今週のサマリーのみ表示）
        </p>
      ) : null}

      {!loading && !error && !isEmpty ? (
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(124,58,237,0.18),transparent_55%)]"
          aria-hidden
        />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
            過去7日間の推移
          </p>
          <h3 className="mt-1 text-base font-semibold text-violet-100">
            目覚めのスッキリ度（1〜5）
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            日ごとの平均スコア
          </p>
          <div className="mt-4 w-full min-w-0">
            <WakeScoreBarChart data={chartData} />
          </div>
        </div>
      </div>
      ) : null}

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
  const previewRows = useMemo(() => buildPreviewRows(), []);
  const adviceRows = loggedIn ? rows : previewRows;
  const displayError =
    loggedIn && (error || warning)
      ? (error ?? warning)
      : null;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
    <section
      id="sleep-dashboard"
      className="relative w-full scroll-mt-24 rounded-3xl border border-white/[0.06] p-5 shadow-[0_0_60px_-24px_rgba(124,58,237,0.45)] sm:p-6"
      style={{ backgroundColor: SURFACE }}
      aria-labelledby="sleep-data-dashboard-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(88,28,135,0.22),transparent_50%)]"
        aria-hidden
      />

      <header className="relative mb-6 text-center sm:text-left">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">
          マイページ
        </p>
        <h2
          id="sleep-data-dashboard-heading"
          className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl"
        >
          睡眠データ分析
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          再生ログから傾向を分析し、心と体のバランスに合う周波数を提案します。
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

        {authReady && !loggedIn ? (
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

    {loggedIn && authReady && !loading ? (
      <SleepBalanceAdvicePanel rows={adviceRows} preview={false} />
    ) : null}
    {authReady && !loggedIn ? (
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm brightness-90">
          <SleepBalanceAdvicePanel rows={previewRows} preview />
        </div>
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs text-slate-500">
          ログインでバランス分析を表示
        </p>
      </div>
    ) : null}
    </div>
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
