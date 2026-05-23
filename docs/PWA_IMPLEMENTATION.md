# PWA・バックグラウンド再生 — 実装ステップ

## 概要

| 要件 | 実装場所 |
|------|----------|
| manifest / standalone | `public/manifest.webmanifest` + `app/layout.tsx` metadata |
| アイコン | `public/icons/*`（`npm run pwa:icons` で PNG 生成） |
| Service Worker | `public/sw.js` |
| SW 登録 | `components/PwaRegister.tsx` → **`app/layout.tsx` の `<body>` 内** |
| バックグラウンド維持 | `lib/backgroundAudioSession.ts` + `hooks/useBackgroundAudioSession.ts` |
| 再生コンポーネント連携 | `HealingToneButton.tsx` / `BinauralBeatPlayer.tsx` |

---

## ステップ 1: 静的ファイル（新規）

1. **`public/manifest.webmanifest`**  
   - `display: "standalone"`  
   - `theme_color` / `background_color`: `#030712`  
   - アイコン 192 / 512 / maskable  

2. **`public/sw.js`**  
   - install / activate / fetch（最小キャッシュ）  

3. **`public/icons/`**  
   - `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`  
   - 生成: `npm run pwa:icons`  

---

## ステップ 2: Service Worker 登録（修正）

**ファイル:** `components/PwaRegister.tsx`（新規）  
**マウント先:** `app/layout.tsx`

```tsx
// app/layout.tsx
import { PwaRegister } from "@/components/PwaRegister";

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <PwaRegister />  {/* ← ここで navigator.serviceWorker.register('/sw.js') */}
      </body>
    </html>
  );
}
```

Next.js に `main.ts` はありません。クライアント処理はこの Client Component が担います。

---

## ステップ 3: layout の PWA メタデータ（修正）

**ファイル:** `app/layout.tsx`

- `metadata.manifest` → `/manifest.webmanifest`  
- `viewport.themeColor` → `#030712`  
- `appleWebApp.capable` → iOS ホーム画面追加  
- `icons` → SVG + PNG  

---

## ステップ 4: Next.js ヘッダー（修正）

**ファイル:** `next.config.ts`

- `/sw.js` に `Cache-Control: no-cache`  
- `Service-Worker-Allowed: /`  

---

## ステップ 5: バックグラウンド再生（新規 + 連携）

**コア:** `lib/backgroundAudioSession.ts`

| 仕組み | 役割 |
|--------|------|
| 無音 `<audio loop>` | iOS/Android で「メディア再生中」セッションを維持 |
| **Web Locks API** | タブがサスペンドされにくくする |
| **Wake Lock API**（任意） | 画面消灯を遅らせる（`requestWakeLock: true` で有効。画面オフ再生とは両立しにくい） |
| **Media Session API** | ロック画面表示・一時停止ボタン |
| `visibilitychange` | 復帰時に `Tone.start()` / `AudioContext.resume()` |

**React フック:** `hooks/useBackgroundAudioSession.ts`  
`playing === true` の間だけ `acquireBackgroundAudioSession()`。

**連携済みコンポーネント:**

- `components/HealingToneButton.tsx` — メイン再生  
- `components/binaural/BinauralBeatPlayer.tsx` — バイナルビート  

---

## ステップ 6: ビルド・デプロイ

```bash
npm run build   # アイコン生成 + next build
```

- **HTTPS 必須**（Vercel 本番で OK）  
- デプロイ後、スマホで「ホーム画面に追加」  

### 動作確認

1. Chrome DevTools → Application → Manifest / Service Workers  
2. 再生開始 → 画面オフ or 他アプリへ → 音が続くか確認  
3. 復帰後も音が続くか確認  

---

## 制限（重要）

- **iOS Safari** は画面オフ後に Web Audio を止めることがあります。無音ループ + 復帰時 resume が現実的な上限です。  
- **100% 保証はできません**。ネイティブアプリほどの信頼性が必要な場合は Capacitor 等を検討してください。  
- 初回再生は **ユーザー操作**（タップ）が必須です。  

---

## オプション: Wake Lock を有効にする

`HealingToneButton.tsx` の `useBackgroundAudioSession` で:

```ts
requestWakeLock: true,
```

画面が消えにくくなりますが、バッテリー消費が増えます。就寝用には `false` 推奨です。
