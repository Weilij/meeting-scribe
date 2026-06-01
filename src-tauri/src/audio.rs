use std::path::Path;
use symphonia::core::{
    audio::SampleBuffer,
    codecs::DecoderOptions,
    formats::FormatOptions,
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
};

/// Decode any audio file to f32 mono samples at 16 kHz (required by Whisper).
pub fn load_audio_as_f32_16k(path: &str) -> Result<Vec<f32>, String> {
    let file =
        std::fs::File::open(path).map_err(|e| format!("無法開啟音訊檔案: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path).extension().and_then(|s| s.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("無法識別音訊格式: {}", e))?;

    let mut format = probed.format;
    let track = format.default_track().ok_or("找不到音訊軌道")?;

    let sample_rate = track
        .codec_params
        .sample_rate
        .ok_or("無法取得取樣率")? as usize;
    let channels = track
        .codec_params
        .channels
        .ok_or("無法取得聲道數")?
        .count();
    let track_id = track.id;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("音訊解碼器錯誤: {}", e))?;

    let mut mono: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(e) => {
                // UnexpectedEof = normal end of stream in symphonia 0.5
                if let symphonia::core::errors::Error::IoError(ref io_err) = e {
                    if io_err.kind() == std::io::ErrorKind::UnexpectedEof {
                        break;
                    }
                }
                return Err(format!("讀取音訊錯誤: {}", e));
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => return Err(format!("解碼錯誤: {}", e)),
        };

        let mut buf =
            SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec());
        buf.copy_interleaved_ref(decoded);

        let samples = buf.samples();
        if channels == 1 {
            mono.extend_from_slice(samples);
        } else {
            for chunk in samples.chunks(channels) {
                mono.push(chunk.iter().sum::<f32>() / channels as f32);
            }
        }
    }

    if sample_rate == 16000 {
        return Ok(mono);
    }

    // Linear interpolation resample to 16 kHz
    let ratio = sample_rate as f64 / 16000.0;
    let out_len = (mono.len() as f64 / ratio) as usize;
    let mut resampled = Vec::with_capacity(out_len);

    for i in 0..out_len {
        let pos = i as f64 * ratio;
        let idx = pos as usize;
        let frac = (pos - idx as f64) as f32;
        let s0 = mono.get(idx).copied().unwrap_or(0.0);
        let s1 = mono.get(idx + 1).copied().unwrap_or(0.0);
        resampled.push(s0 + frac * (s1 - s0));
    }

    Ok(resampled)
}
