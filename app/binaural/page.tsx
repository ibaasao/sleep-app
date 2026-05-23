import { BinauralBeatPlayer } from "@/components/binaural/BinauralBeatPlayer";

export default function BinauralPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.12),transparent_55%)]"
        aria-hidden
      />
      <BinauralBeatPlayer />
    </main>
  );
}
