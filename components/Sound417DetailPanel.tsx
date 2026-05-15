"use client";

export type Sound417Settings = {
  resonanceIntensity: number;
  textureMix: number;
  spatializer: number;
};

export const DEFAULT_SOUND_417_SETTINGS: Sound417Settings = {
  resonanceIntensity: 0.55,
  textureMix: 0.35,
  spatializer: 0.5,
};

type SliderRowProps = {
  label: string;
  sublabel: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
};

function SliderRow({
  label,
  sublabel,
  value,
  onChange,
  disabled,
}: SliderRowProps) {
  const pct = Math.round(value * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-violet-100">{label}</p>
          <p className="text-[10px] text-slate-500">{sublabel}</p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-violet-300/90">
          {pct}%
        </span>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-800/90" />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-600/80 to-fuchsia-500/70"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          disabled={disabled}
          value={Math.round(value * 1000)}
          onChange={(e) => onChange(Number(e.target.value) / 1000)}
          className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-40 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-300 [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(167,139,250,0.75)] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-violet-300 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(167,139,250,0.75)]"
          aria-label={label}
        />
      </div>
    </div>
  );
}

type Sound417DetailPanelProps = {
  settings: Sound417Settings;
  onChange: (next: Sound417Settings) => void;
  disabled?: boolean;
};

export function Sound417DetailPanel({
  settings,
  onChange,
  disabled,
}: Sound417DetailPanelProps) {
  return (
    <div className="mt-3 space-y-4 border-t border-violet-500/25 pt-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300/80">
        417 Hz — Detail
      </p>
      <SliderRow
        label="Resonance Intensity"
        sublabel="共鳴の強さ"
        value={settings.resonanceIntensity}
        onChange={(resonanceIntensity) =>
          onChange({ ...settings, resonanceIntensity })
        }
        disabled={disabled}
      />
      <SliderRow
        label="Texture Mix"
        sublabel="環境音の混ざり具合"
        value={settings.textureMix}
        onChange={(textureMix) => onChange({ ...settings, textureMix })}
        disabled={disabled}
      />
      <SliderRow
        label="Spatializer"
        sublabel="音の広がり"
        value={settings.spatializer}
        onChange={(spatializer) => onChange({ ...settings, spatializer })}
        disabled={disabled}
      />
    </div>
  );
}
