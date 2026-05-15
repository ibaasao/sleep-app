"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

import { SESSION_EVOLVE_REVEAL_MS } from "@/hooks/usePlaybackTimeManager";
import {
  BREATH_CYCLE_MS,
  getBreathPulse,
  getSessionTheme,
  rgba,
} from "@/components/session/sessionTheme";
import { getLockPullStrength } from "@/components/session/syncLockMotion";

type Particle = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  drift: number;
  speed: number;
};

type Star = {
  x: number;
  y: number;
  r: number;
  phase: number;
};

type Props = {
  active: boolean;
  soundId: string;
  alignmentBurstAt: number | null;
  syncLocked: boolean;
  /** 0 = Relax（穏やか）… 1 = Ethereal（高密度）— 毎フレーム読むので ref */
  immersionRef: MutableRefObject<number>;
  /** 進行前（0〜12秒台）: 深い紺と極わずかなパルスのみ */
  preSyncMinimal?: boolean;
  /** 進化成立時の performance.now()（0.5s かけてフル背景へブレンド） */
  evolveAnimStartedAt?: number | null;
};

function createParticles(width: number, height: number): Particle[] {
  const count = Math.min(90, Math.floor((width * height) / 14000));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.6 + Math.random() * 1.6,
    alpha: 0.08 + Math.random() * 0.22,
    drift: Math.random() * Math.PI * 2,
    speed: 0.08 + Math.random() * 0.18,
  }));
}

function createStars(width: number, height: number): Star[] {
  const count = Math.min(96, Math.floor((width * height) / 12000));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 0.35 + Math.random() * 1.15,
    phase: Math.random() * Math.PI * 2,
  }));
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function drawPreSyncBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  time: number,
) {
  const cycle = 26000;
  const phase = (time % cycle) / cycle;
  const slow = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  context.fillStyle = "#060a14";
  context.fillRect(0, 0, width, height);
  const grd = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    Math.max(width, height) * 0.48,
  );
  grd.addColorStop(0, `rgba(28, 48, 82, ${0.1 + slow * 0.05})`);
  grd.addColorStop(0.55, "rgba(10, 20, 38, 0.02)");
  grd.addColorStop(1, "rgba(6, 10, 20, 0)");
  context.fillStyle = grd;
  context.fillRect(0, 0, width, height);
}

function drawStarfield(
  context: CanvasRenderingContext2D,
  stars: Star[],
  time: number,
  theme: ReturnType<typeof getSessionTheme>,
  alphaMul: number,
) {
  for (const s of stars) {
    const tw = 0.35 + 0.65 * Math.sin(time * 0.0011 + s.phase);
    context.beginPath();
    context.fillStyle = rgba(
      theme.particleRgb,
      0.12 * tw * alphaMul * (0.55 + 0.45 * Math.sin(time * 0.0008 + s.phase * 2)),
    );
    context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    context.fill();
  }
}

function drawWaveRibbons(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  theme: ReturnType<typeof getSessionTheme>,
  alphaMul: number,
) {
  const lines = 5;
  for (let i = 0; i < lines; i += 1) {
    const baseY = (height * (0.22 + (i / lines) * 0.56)) | 0;
    const speed = 0.00035 + i * 0.00006;
    const amp = 14 + i * 5;
    const phase = time * speed + i * 1.7;

    context.beginPath();
    context.moveTo(0, baseY + Math.sin(phase) * amp);
    for (let x = 4; x <= width; x += 8) {
      const y =
        baseY +
        Math.sin(phase + x * 0.012 + i * 0.4) * amp +
        Math.sin(phase * 1.3 + x * 0.004) * (amp * 0.35);
      context.lineTo(x, y);
    }
    context.strokeStyle = rgba(
      i % 2 === 0 ? theme.primaryRgb : theme.accentRgb,
      (0.04 + (i / lines) * 0.05) * alphaMul,
    );
    context.lineWidth = 1.1;
    context.stroke();
  }
}

export function SessionAmbientField({
  active,
  soundId,
  alignmentBurstAt,
  syncLocked,
  immersionRef,
  preSyncMinimal = false,
  evolveAnimStartedAt = null,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const theme = getSessionTheme(soundId);
  const evolveT0Ref = useRef<number | null>(null);
  evolveT0Ref.current = evolveAnimStartedAt ?? null;

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let particles: Particle[] = [];
    let stars: Star[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { innerWidth, innerHeight } = window;
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles(innerWidth, innerHeight);
      stars = createStars(innerWidth, innerHeight);
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const centerX = width * 0.5;
      const centerY = height * 0.42;

      if (preSyncMinimal) {
        drawPreSyncBackground(
          context,
          width,
          height,
          centerX,
          centerY,
          time,
        );
        frameId = window.requestAnimationFrame(draw);
        return;
      }

      const evolveT0 = evolveT0Ref.current;
      const evolveBlendRaw =
        evolveT0 != null
          ? Math.min(
              1,
              Math.max(0, (time - evolveT0) / SESSION_EVOLVE_REVEAL_MS),
            )
          : 1;
      const evolveEase = easeOutCubic(evolveBlendRaw);
      const layerA = evolveBlendRaw < 1 ? evolveEase : 1;

      if (evolveBlendRaw < 1) {
        drawPreSyncBackground(
          context,
          width,
          height,
          centerX,
          centerY,
          time,
        );
      } else {
        context.clearRect(0, 0, width, height);
      }

      const pulse = syncLocked ? 0.58 : getBreathPulse(time);
      const pullStrength = getLockPullStrength(
        alignmentBurstAt,
        time,
        syncLocked,
      );

      const gradient = context.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        Math.max(width, height) * (0.56 + pulse * 0.06),
      );
      gradient.addColorStop(
        0,
        rgba(theme.primaryRgb, (0.08 + pulse * 0.05) * layerA),
      );
      gradient.addColorStop(
        0.45,
        rgba(theme.accentRgb, (0.03 + pulse * 0.04) * layerA),
      );
      gradient.addColorStop(1, rgba(theme.glowRgb, 0));
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      if (syncLocked) {
        const ringRadius = Math.min(width, height) * 0.34;
        const rotation = time * 0.00006;

        context.save();
        context.translate(centerX, centerY);
        context.rotate(rotation);
        context.beginPath();
        context.strokeStyle = rgba(theme.primaryRgb, 0.16 * layerA);
        context.lineWidth = 2;
        context.arc(0, 0, ringRadius, 0, Math.PI * 2);
        context.stroke();

        context.beginPath();
        context.strokeStyle = rgba(theme.accentRgb, 0.1 * layerA);
        context.lineWidth = 1;
        context.arc(0, 0, ringRadius * 0.82, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      const immersion =
        soundId === "s3"
          ? Math.min(1, Math.max(0, immersionRef.current))
          : 0.46;
      const flowMul = 0.38 + immersion * 1.35;

      for (const particle of particles) {
        if (!reduceMotion) {
          if (pullStrength > 0.02) {
            const pull = 0.18 + pullStrength * 0.62;
            particle.x += (centerX - particle.x) * pull;
            particle.y += (centerY - particle.y) * pull;
          } else if (!syncLocked) {
            particle.drift += particle.speed * 0.01 * flowMul;
            particle.x += Math.cos(particle.drift) * (0.1 + immersion * 0.14);
            particle.y += Math.sin(particle.drift) * (0.07 + immersion * 0.09);
          }
        }

        if (!syncLocked) {
          if (particle.x < -8) particle.x = width + 8;
          if (particle.x > width + 8) particle.x = -8;
          if (particle.y < -8) particle.y = height + 8;
          if (particle.y > height + 8) particle.y = -8;
        }

        const localTwinkle =
          0.92 +
          Math.sin(time * (0.0018 + immersion * 0.014) + particle.drift) *
            (0.06 + immersion * 0.14) +
          Math.sin(
            time * (0.0024 + immersion * 0.022) + particle.drift * 2.1,
          ) *
            (0.04 + immersion * 0.1);

        context.beginPath();
        context.fillStyle = rgba(
          theme.particleRgb,
          particle.alpha *
            (0.55 + pulse * 0.35) *
            (0.65 + pullStrength * 0.35) *
            localTwinkle *
            layerA,
        );
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      drawStarfield(context, stars, time, theme, layerA);
      drawWaveRibbons(context, width, height, time, theme, layerA);

      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    frameId = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [
    active,
    alignmentBurstAt,
    immersionRef,
    preSyncMinimal,
    reduceMotion,
    soundId,
    syncLocked,
    theme,
  ]);

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={`session-ambient-${soundId}`}
          className="pointer-events-none fixed inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            scale: syncLocked || reduceMotion ? 1 : [0.985, 1.02, 0.985],
          }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 0.8 },
            scale: syncLocked
              ? { duration: 0.3 }
              : {
                  duration: BREATH_CYCLE_MS / 1000,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
          }}
        >
          <canvas ref={canvasRef} className="h-full w-full" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
