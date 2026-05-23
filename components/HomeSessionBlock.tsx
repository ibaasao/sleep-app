"use client";

import { HealingToneButton } from "@/components/HealingToneButton";
import {
  HeartRateTest,
  type HeartRateSessionPreset,
} from "@/components/HeartRateTest";
import { useCallback, useState } from "react";

type Props = {
  loginId: string | null;
};

export function HomeSessionBlock({ loginId }: Props) {
  const [heartSessionPreset, setHeartSessionPreset] =
    useState<HeartRateSessionPreset | null>(null);

  const onSessionStart = useCallback((preset: HeartRateSessionPreset) => {
    setHeartSessionPreset(preset);
  }, []);

  const onHeartSessionConsumed = useCallback(() => {
    setHeartSessionPreset(null);
  }, []);

  return (
    <>
      <HealingToneButton
        loginId={loginId}
        heartSessionPreset={heartSessionPreset}
        onHeartSessionConsumed={onHeartSessionConsumed}
      />
      <HeartRateTest className="mt-2" onSessionStart={onSessionStart} />
    </>
  );
}
