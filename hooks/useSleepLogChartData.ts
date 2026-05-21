"use client";

import {
  emptyChartSeries,
  fetchSleepLogChartData,
  type FetchSleepLogChartResult,
  type SleepLogChartPoint,
  type SleepLogRow,
} from "@/lib/fetchSleepLogChartData";
import { useCallback, useEffect, useState } from "react";

export type UseSleepLogChartDataState = {
  /** recharts 等に渡す [{ date, score, duration, ... }] */
  chartData: SleepLogChartPoint[];
  /** 生の sleep_logs 行（サマリー集計用） */
  rows: SleepLogRow[];
  loading: boolean;
  error: string | null;
  warning: string | null;
  refetch: () => Promise<void>;
};

/**
 * ログイン中ユーザーの過去7日間 sleep_logs を取得し、グラフ用データを返す。
 * @param enabled — false のときは fetch しない（未ログイン向け）
 */
export function useSleepLogChartData(
  enabled: boolean,
): UseSleepLogChartDataState {
  const [chartData, setChartData] = useState<SleepLogChartPoint[]>(() =>
    emptyChartSeries(),
  );
  const [rows, setRows] = useState<SleepLogRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const applyResult = useCallback((result: FetchSleepLogChartResult) => {
    setChartData(result.chartData);
    if (result.ok) {
      setRows(result.rows);
      setError(null);
      setWarning(null);
    } else {
      setRows([]);
      setError(result.error ?? null);
      setWarning(result.warning ?? null);
    }
  }, []);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setChartData(emptyChartSeries());
      setRows([]);
      setLoading(false);
      setError(null);
      setWarning(null);
      return;
    }

    setLoading(true);
    const result = await fetchSleepLogChartData();
    applyResult(result);
    setLoading(false);
  }, [enabled, applyResult]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!enabled) {
        setChartData(emptyChartSeries());
        setRows([]);
        setLoading(false);
        setError(null);
        setWarning(null);
        return;
      }

      setLoading(true);
      const result = await fetchSleepLogChartData();
      if (cancelled) return;
      applyResult(result);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, applyResult]);

  return {
    chartData,
    rows,
    loading,
    error,
    warning,
    refetch,
  };
}
