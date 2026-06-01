use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

fn model_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".meeting-scribe")
        .join("models")
}

fn model_path(model: &str) -> PathBuf {
    model_dir().join(format!("ggml-{}.bin", model))
}

fn map_lang(lang: &str) -> &str {
    match lang {
        "zh-TW" | "zh-CN" => "zh",
        "en" => "en",
        _ => "auto",
    }
}

#[tauri::command]
pub fn is_model_downloaded(model: String) -> bool {
    model_path(&model).exists()
}

#[tauri::command]
pub async fn download_whisper_model(
    app: AppHandle,
    model: String,
) -> Result<(), String> {
    let path = model_path(&model);
    if path.exists() {
        return Ok(());
    }

    tokio::fs::create_dir_all(model_dir())
        .await
        .map_err(|e| format!("建立資料夾失敗: {}", e))?;

    let url = format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{}.bin",
        model
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("下載請求失敗: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("下載失敗，HTTP {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(0);

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| format!("建立檔案失敗: {}", e))?;

    let mut downloaded = 0u64;
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下載中斷: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("寫入失敗: {}", e))?;
        downloaded += chunk.len() as u64;
        let pct = if total > 0 { downloaded * 100 / total } else { 0 };
        app.emit("whisper-download-progress", pct).ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn transcribe_audio(
    file_path: String,
    model: String,
    language: String,
) -> Result<String, String> {
    let path = model_path(&model);
    if !path.exists() {
        return Err(format!("Whisper 模型尚未下載: {}", model));
    }

    let lang = map_lang(&language).to_string();

    tokio::task::spawn_blocking(move || {
        let samples = crate::audio::load_audio_as_f32_16k(&file_path)?;

        use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

        let ctx = WhisperContext::new_with_params(
            path.to_str().unwrap(),
            WhisperContextParameters::default(),
        )
        .map_err(|e| format!("載入模型失敗: {:?}", e))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        if lang != "auto" {
            params.set_language(Some(&lang));
        }
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        let mut state = ctx
            .create_state()
            .map_err(|e| format!("建立 Whisper 狀態失敗: {:?}", e))?;

        state
            .full(params, &samples)
            .map_err(|e| format!("語音辨識失敗: {:?}", e))?;

        let n = state
            .full_n_segments()
            .map_err(|e| format!("取得片段數失敗: {:?}", e))?;

        let mut transcript = String::new();
        for i in 0..n {
            let seg = state
                .full_get_segment_text(i)
                .map_err(|e| format!("取得片段失敗: {:?}", e))?;
            transcript.push_str(&seg);
        }

        Ok(transcript.trim().to_string())
    })
    .await
    .map_err(|e| format!("執行緒錯誤: {}", e))?
}
