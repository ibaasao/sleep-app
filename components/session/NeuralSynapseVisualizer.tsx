"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

import { getBreathPulse, getSessionTheme, rgba } from "@/components/session/sessionTheme";
import { getLockPullStrength } from "@/components/session/syncLockMotion";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchorX: number;
  phase: number;
  breathPhase: number;
};

type Link = {
  from: number;
  to: number;
  pulse: number;
  speed: number;
  primary: boolean;
};

type Props = {
  active: boolean;
  soundId: string;
  alignmentBurstAt: number | null;
  syncLocked: boolean;
  immersionRef: MutableRefObject<number>;
};

function createNetwork(width: number, height: number) {
  const nodeCount = 14;
  const nodes: Node[] = Array.from({ length: nodeCount }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.22,
    anchorX: 0.08 + (index / (nodeCount - 1)) * 0.84,
    phase: Math.random() * Math.PI * 2,
    breathPhase: Math.random() * Math.PI * 2,
  }));

  const links: Link[] = [];
  for (let index = 0; index < nodeCount - 1; index += 1) {
    links.push({
      from: index,
      to: index + 1,
      pulse: Math.random(),
      speed: 0.0018 + Math.random() * 0.0028,
      primary: true,
    });
  }

  for (let index = 0; index < nodeCount - 2; index += 2) {
    links.push({
      from: index,
      to: index + 2,
      pulse: Math.random(),
      speed: 0.001 + Math.random() * 0.0016,
      primary: false,
    });
  }

  return { nodes, links };
}

function getResonanceTarget(
  node: Node,
  width: number,
  height: number,
  time: number,
  locked: boolean,
) {
  const breath = getBreathPulse(time + node.breathPhase * 180);
  const wave =
    Math.sin(node.anchorX * Math.PI * 2.15 + time * 0.00042 + node.phase) *
      0.62 +
    Math.sin(node.anchorX * Math.PI * 4.6 + node.phase * 1.4) * 0.2;
  const driftX = Math.sin(time * 0.00033 + node.phase) * (locked ? 3.5 : 5.5);
  const driftY = Math.cos(time * 0.00029 + node.breathPhase) * (locked ? 2.2 : 3.5);

  return {
    x: width * node.anchorX + driftX,
    y:
      height *
        (0.5 +
          wave * (locked ? 0.1 : 0.14) * (0.68 + breath * 0.32)) +
      driftY,
    breath,
  };
}

export function NeuralSynapseVisualizer({
  active,
  soundId,
  alignmentBurstAt,
  syncLocked,
  immersionRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const theme = getSessionTheme(soundId);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let network = createNetwork(canvas.clientWidth, canvas.clientHeight);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      network = createNetwork(width, height);
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const immersion =
        soundId === "s3"
          ? Math.min(1, Math.max(0, immersionRef.current))
          : 0.355;
      const synapseSpeed = 0.45 + immersion * 1.55;
      const pullStrength = getLockPullStrength(
        alignmentBurstAt,
        time,
        syncLocked,
      );

      context.clearRect(0, 0, width, height);

      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, rgba(theme.glowRgb, syncLocked ? 0.22 : 0.28));
      background.addColorStop(1, rgba(theme.primaryRgb, syncLocked ? 0.1 : 0.12));
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      for (const node of network.nodes) {
        const target = getResonanceTarget(node, width, height, time, syncLocked);

        if (!reduceMotion) {
          if (pullStrength > 0.02 || syncLocked) {
            const follow = syncLocked
              ? 0.038 + target.breath * 0.018
              : 0.18 + pullStrength * 0.48;
            node.x += (target.x - node.x) * follow;
            node.y += (target.y - node.y) * follow;
            node.vx *= 0.9;
            node.vy *= 0.9;
          } else {
            const vm = 0.55 + immersion * 0.95;
            node.x += node.vx * vm;
            node.y += node.vy * vm;
            if (node.x < 0 || node.x > width) node.vx *= -1;
            if (node.y < 0 || node.y > height) node.vy *= -1;
          }
        }
      }

      for (const link of network.links) {
        const from = network.nodes[link.from];
        const to = network.nodes[link.to];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy);
        if (!syncLocked && distance > width * 0.34) continue;

        const flowSpeed = syncLocked
          ? link.speed * (link.primary ? 0.42 : 0.28)
          : link.speed * synapseSpeed;
        link.pulse = (link.pulse + flowSpeed) % 1;
        const intensity =
          0.22 +
          Math.sin(link.pulse * Math.PI * 2 + link.from) * 0.16 +
          (syncLocked ? 0.12 : 0);

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - dy * 0.08;
        const lineAlpha =
          (link.primary ? 0.16 : 0.08) +
          intensity * (link.primary ? 0.34 : 0.18);

        context.beginPath();
        context.moveTo(from.x, from.y);
        context.quadraticCurveTo(midX, midY, to.x, to.y);
        context.strokeStyle = rgba(
          theme.lineRgb,
          lineAlpha * (0.72 + pullStrength * 0.22),
        );
        context.lineWidth = link.primary ? 1 + pullStrength * 0.35 : 0.8;
        context.stroke();

        const particleT = link.pulse;
        const particleX =
          (1 - particleT) * (1 - particleT) * from.x +
          2 * (1 - particleT) * particleT * midX +
          particleT * particleT * to.x;
        const particleY =
          (1 - particleT) * (1 - particleT) * from.y +
          2 * (1 - particleT) * particleT * midY +
          particleT * particleT * to.y;

        context.beginPath();
        context.fillStyle = rgba(
          theme.accentRgb,
          (link.primary ? 0.42 : 0.24) + intensity * 0.35,
        );
        context.arc(
          particleX,
          particleY,
          link.primary ? 1.5 + intensity * 0.8 : 1.1,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      for (const node of network.nodes) {
        const target = getResonanceTarget(node, width, height, time, syncLocked);
        const glow = 0.22 + target.breath * 0.2;

        const halo = context.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          11,
        );
        halo.addColorStop(0, rgba(theme.accentRgb, glow));
        halo.addColorStop(0.45, rgba(theme.primaryRgb, glow * 0.35));
        halo.addColorStop(1, rgba(theme.primaryRgb, 0));
        context.fillStyle = halo;
        context.beginPath();
        context.arc(node.x, node.y, 11, 0, Math.PI * 2);
        context.fill();

        context.beginPath();
        context.fillStyle = rgba(
          theme.particleRgb,
          0.62 + target.breath * 0.28,
        );
        context.arc(node.x, node.y, 2.1, 0, Math.PI * 2);
        context.fill();

        context.beginPath();
        context.strokeStyle = rgba(
          theme.primaryRgb,
          0.22 + target.breath * 0.18 + pullStrength * 0.12,
        );
        context.arc(node.x, node.y, 5.5 + target.breath * 1.2, 0, Math.PI * 2);
        context.stroke();
      }

      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    frameId = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [active, alignmentBurstAt, immersionRef, reduceMotion, soundId, syncLocked, theme]);

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          className={`relative z-10 overflow-hidden rounded-2xl border bg-slate-950/40 ${
            syncLocked
              ? "mb-6 border-violet-500/10"
              : "mb-4 border-violet-500/15"
          }`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: syncLocked ? 0.9 : 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <canvas ref={canvasRef} className="h-28 w-full sm:h-32" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
