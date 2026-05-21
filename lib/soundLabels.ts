/** sleep_logs.sound_id → 表示名 */
export const SOUND_ID_LABELS: Record<string, string> = {
  s1: "396 Hz",
  s2: "417 Hz",
  s3: "528 Hz",
  s4: "639 Hz",
  s5: "741 Hz",
  s6: "852 Hz",
  n1: "Brown Noise",
  n2: "Pink Noise",
  n3: "Delta Wave",
  n4: "Theta Wave",
  n5: "Deep Ocean",
  n6: "Cosmic Humming",
  n7: "Solstice Breath",
  rain: "Rainy Night",
};

export function labelForSoundId(soundId: string): string {
  return SOUND_ID_LABELS[soundId] ?? soundId;
}

const LABEL_TO_SOUND_ID = Object.fromEntries(
  Object.entries(SOUND_ID_LABELS).map(([id, label]) => [label, id]),
) as Record<string, string>;

/** 旧 sleep_logs.notes.label などから sound_id を推定 */
export function soundIdFromLabel(label: string): string {
  return LABEL_TO_SOUND_ID[label] ?? label;
}
