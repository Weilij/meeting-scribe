# MeetingScribe 🎙

> AI 驅動的桌面會議記錄助手 — 錄音、轉文字、整理大綱，一氣呵成

MeetingScribe 是一款開源桌面應用程式，讓你用自己的 AI API Key 把會議錄音自動轉成結構化的大綱與重點。完全免費、隱私優先，音訊不上傳任何雲端伺服器。

---

## 📥 直接下載安裝（不需要 Git / Node / Rust）

| 平台 | 下載 |
|------|------|
| **macOS** (Apple Silicon / Intel) | [MeetingScribe-0.1.0-mac.dmg](https://github.com/Weilij/meeting-scribe/releases/latest) |

**安裝步驟：**
1. 下載 `.dmg` 檔案
2. 雙擊打開 → 把 `meeting-scribe.app` 拖到 Applications
3. **第一次開啟**：右鍵點 App → 選「開啟」→ 確認（繞過 macOS 未簽名警告）
4. 前往「設定」填入你的 AI API Key 即可使用

> Windows 版本即將推出

---

## ✨ 功能特色

| 功能 | 說明 |
|------|------|
| 🎙 **麥克風錄音** | 一鍵錄音，即時波形動畫，支援長時間錄製 |
| 📁 **上傳音訊** | 支援 MP3、M4A、WAV、MP4、OGG、FLAC |
| 📋 **貼上逐字稿** | 直接貼上文字，跳過語音轉文字步驟 |
| 🔊 **本地 Whisper** | 語音辨識完全在本機執行，不上傳音訊 |
| 🤖 **多 AI Provider** | Claude、GPT、Gemini、Ollama，自帶 API Key |
| 📝 **結構化摘要** | 一句話摘要、大綱、重點、待辦事項 |
| 📄 **匯出 Word/PDF** | 一鍵匯出，中文完整顯示 |

---

## 系統需求（自行編譯）

> 如果只是要使用 App，直接從上方下載即可，不需要以下工具。

- macOS 10.15+ 或 Windows 10+
- Node.js 18+
- Rust 1.70+
- cmake（用於編譯 Whisper.cpp）

---

## 🚀 快速開始

### 1. 安裝依賴工具

**macOS：**
```bash
brew install cmake
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Windows：**
```powershell
winget install Rustlang.Rustup
winget install Kitware.CMake
```

### 2. 克隆並啟動

```bash
git clone https://github.com/Weilij/meeting-scribe.git
cd meeting-scribe
npm install
npm run tauri dev
```

> ⚠️ 首次編譯 Whisper.cpp 約需 3–5 分鐘，之後啟動速度正常。

---

## ⚙️ 設定 AI Provider

開啟 App 後前往「設定」頁面，選擇 AI Provider 並填入 API Key：

| Provider | 取得 API Key | 免費額度 |
|----------|-------------|---------|
| **Claude** (Anthropic) | [console.anthropic.com](https://console.anthropic.com) | 付費制 |
| **GPT** (OpenAI) | [platform.openai.com](https://platform.openai.com/api-keys) | 付費制 |
| **Gemini** (Google) | [aistudio.google.com](https://aistudio.google.com/app/apikey) | 有免費額度 |
| **Ollama** | [ollama.com](https://ollama.com)（本機安裝） | 完全免費 |

---

## 🔊 Whisper 語音模型

首次使用時自動從 HuggingFace 下載，儲存於 `~/.meeting-scribe/models/`：

| 模型 | 大小 | 建議 |
|------|------|------|
| Tiny | 75 MB | 測試用 |
| **Base** | 145 MB | ✅ 預設推薦 |
| Small | 460 MB | 會議品質 |
| Medium | 1.5 GB | 重要場合 |

---

## 📖 使用流程

```
選擇模式
  ├── 🎙 錄音     → 開始/停止錄音 → 整理重點
  ├── 📁 上傳音訊 → 選擇檔案     → 整理重點
  └── 📋 逐字稿   → 貼上文字     → 整理重點（跳過 Whisper）
        ↓
  Whisper 本地語音轉文字
        ↓
  AI 整理摘要（大綱、重點、待辦事項）
        ↓
  匯出 Word / PDF
```

---

## 🛠 技術架構

```
前端框架    React 19 + TypeScript + Tailwind CSS v4
桌面框架    Tauri v2（Rust）
語音辨識    whisper-rs（whisper.cpp Rust 綁定，支援 Apple Silicon Metal 加速）
音訊解碼    symphonia（MP3/M4A/WAV/OGG/FLAC）
AI 整合     Anthropic SDK / OpenAI SDK / Google Generative AI
匯出        docx（Word）、html2canvas + jsPDF（PDF）
```

---

## 🔒 隱私說明

- 音訊檔案**不會**上傳到任何雲端伺服器
- Whisper 語音辨識完全在本機執行
- API Key 僅儲存於本機 localStorage
- 僅逐字稿文字會送至你選擇的 AI API

---

## 📁 專案結構

```
meeting-scribe/
├── src/                        # React 前端
│   ├── pages/                  # Home、Summary、Settings
│   ├── components/Layout.tsx   # macOS 風格側欄
│   ├── services/
│   │   ├── ai/                 # Claude、OpenAI、Gemini、Ollama
│   │   ├── exporter.ts         # Word/PDF 匯出
│   │   └── recorder.ts         # 麥克風錄音 + WAV 編碼
│   └── store/settingsStore.ts  # 設定持久化
└── src-tauri/src/
    ├── audio.rs                # 音訊解碼 + 重採樣至 16kHz
    └── whisper_cmd.rs          # Whisper 模型下載與推論
```

---

## 開發指令

```bash
npm run tauri dev     # 開發模式
npm run tauri build   # 打包發布
npx tsc --noEmit      # TypeScript 型別檢查
```

---

## License

MIT © 2026 — [Weilij](https://github.com/Weilij)
