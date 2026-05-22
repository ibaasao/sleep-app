/** 音源ごとの心・体への働きかけ（ソルフェジオ／睡眠音のテーマ） */
export type SoundWellnessProfile = {
  mind: number;
  body: number;
  theme: string;
  balanceTip: string;
};

export const SOUND_WELLNESS: Record<string, SoundWellnessProfile> = {
  s1: {
    mind: 88,
    body: 58,
    theme: "解放・地に足",
    balanceTip: "不安や恐怖をほどき、心の重さを下げたいときに。体はゆるめつつ、まず心を整えます。",
  },
  s2: {
    mind: 72,
    body: 78,
    theme: "回復・変化",
    balanceTip: "変化の兆しを促し、心身の回復リズムを取り戻したいときに。バランス型の基調音です。",
  },
  s3: {
    mind: 82,
    body: 84,
    theme: "修復・調和",
    balanceTip: "心と体の両方を穏やかに整える定番。全体のバランスを取り戻すのに向いています。",
  },
  s4: {
    mind: 90,
    body: 52,
    theme: "つながり・共感",
    balanceTip: "人間関係や心のつながりを大切にしたいとき。心の側を優先して整えます。",
  },
  s5: {
    mind: 76,
    body: 62,
    theme: "表現・浄化",
    balanceTip: "もやもやを言語化・解放し、思考をクリアにしたいとき。心の流れを整えます。",
  },
  s6: {
    mind: 94,
    body: 48,
    theme: "直感・精神性",
    balanceTip: "瞑想や内省で精神面を高めたいとき。体より意識・直感の領域をサポートします。",
  },
  n1: {
    mind: 48,
    body: 90,
    theme: "深い休息",
    balanceTip: "思考を止め、体の深いリラックスを優先したい夜に。",
  },
  n2: {
    mind: 52,
    body: 82,
    theme: "安定した眠り",
    balanceTip: "心地よいノイズで神経を鎮め、眠りの質を支えます。",
  },
  n3: {
    mind: 40,
    body: 95,
    theme: "深眠",
    balanceTip: "デルタ波で体の回復を最優先。深い睡眠リズム向けです。",
  },
  n4: {
    mind: 70,
    body: 72,
    theme: "瞑想・シータ",
    balanceTip: "浅い瞑想と体のゆるみの両方。心身の中間リズムです。",
  },
  n5: {
    mind: 45,
    body: 88,
    theme: "海のうねり",
    balanceTip: "低周波の揺らぎで体の緊張をほぐし、眠気を誘います。",
  },
  n6: {
    mind: 78,
    body: 76,
    theme: "宇宙的和",
    balanceTip: "複数周波数の重なりで心身を包み込むハーモニー向けです。",
  },
  n7: {
    mind: 80,
    body: 80,
    theme: "呼吸同期",
    balanceTip: "呼吸に合わせた528Hzで心身の同調を取り戻します。",
  },
  rain: {
    mind: 55,
    body: 75,
    theme: "雨音",
    balanceTip: "環境音で心を静め、体の緊張を下げる定番の睡眠サポートです。",
  },
};

const DEFAULT_PROFILE: SoundWellnessProfile = {
  mind: 60,
  body: 60,
  theme: "総合",
  balanceTip: "心身のリズムを整えるサウンドです。",
};

export function getSoundWellness(soundId: string): SoundWellnessProfile {
  return SOUND_WELLNESS[soundId] ?? DEFAULT_PROFILE;
}
