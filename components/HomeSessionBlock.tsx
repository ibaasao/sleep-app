"use client";

import { HealingToneButton } from "@/components/HealingToneButton";
import {
  HeartRateTest,
  type HeartRateSessionPreset,
} from "@/components/HeartRateTest";
import { useCallback, useState } from "react";

type Props = {
  email: string | null;
};

export function HomeSessionBlock({ email }: Props) {
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
        email={email}
        heartSessionPreset={heartSessionPreset}
        onHeartSessionConsumed={onHeartSessionConsumed}
      />
      <HeartRateTest className="mt-2" onSessionStart={onSessionStart} />
    </>
  );
}
