// apps/desktop/src-tauri/src/audio_preprocess.rs

use std::os::raw::c_int;

/// サンプリングレート
const SAMPLE_RATE: usize = 16_000;

/// VADのフレームサイズ
const VAD_FRAME_SIZE: usize = SAMPLE_RATE / 50;

/// 無音とみなす振幅の閾値
const SILENCE_THRESHOLD: f32 = 0.01;

/// 正規化後の目標音量
const TARGET_RMS: f32 = 0.1;

/// 増幅率の上限
const MAX_GAIN: f32 = 10.0;

/// トリミング時に前後へ残す長さ
const TRIM_MARGIN: usize = SAMPLE_RATE / 10;

// Cライブラリの関数宣言
unsafe extern "C" {
    fn trim_silence(
        samples: *const f32,
        sample_count: usize,
        threshold: f32,
        out_start: *mut usize,
        out_length: *mut usize,
    ) -> c_int;

    fn detect_voice_activity(
        samples: *const f32,
        sample_count: usize,
        frame_size: usize,
        threshold: f32,
        out_start: *mut usize,
        out_length: *mut usize,
    ) -> c_int;

    fn normalize_volume(
        samples: *mut f32,
        sample_count: usize,
        target_rms: f32,
        max_gain: f32,
    ) -> c_int;
}

/// 前処理の失敗理由
#[derive(Debug, PartialEq)]
pub enum PreprocessError {
    /// 発話の未検出
    NoVoiceDetected,
}

/// 前後の無音を除いた有音区間の範囲
pub fn find_voiced_range(samples: &[f32], threshold: f32) -> Option<(usize, usize)> {
    let mut start: usize = 0;
    let mut length: usize = 0;

    let found = unsafe {
        trim_silence(
            samples.as_ptr(),
            samples.len(),
            threshold,
            &mut start,
            &mut length,
        )
    };

    if found != 1 {
        return None;
    }

    // 返された範囲の検証
    if start.checked_add(length)? > samples.len() {
        return None;
    }

    Some((start, length))
}

/// 発話区間の範囲
pub fn find_speech_range(samples: &[f32], frame_size: usize, threshold: f32) -> Option<(usize, usize)> {
    let mut start: usize = 0;
    let mut length: usize = 0;

    let found = unsafe {
        detect_voice_activity(
            samples.as_ptr(),
            samples.len(),
            frame_size,
            threshold,
            &mut start,
            &mut length,
        )
    };

    if found != 1 {
        return None;
    }

    if start.checked_add(length)? > samples.len() {
        return None;
    }

    Some((start, length))
}

/// 音量の正規化
pub fn apply_volume_normalize(samples: &mut [f32], target_rms: f32, max_gain: f32) -> bool {
    let applied = unsafe {
        normalize_volume(samples.as_mut_ptr(), samples.len(), target_rms, max_gain)
    };

    applied == 1
}

/// 前後にマージンを足した範囲
pub fn expand_range(start: usize, length: usize, margin: usize, total: usize) -> (usize, usize) {
    let expanded_start = start.saturating_sub(margin);
    let expanded_end = (start + length + margin).min(total);

    (expanded_start, expanded_end - expanded_start)
}

/// 録音データの前処理
pub fn preprocess(samples: &[f32]) -> Result<Vec<f32>, PreprocessError> {
    let mut buffer = samples.to_vec();

    apply_volume_normalize(&mut buffer, TARGET_RMS, MAX_GAIN);

    if find_speech_range(&buffer, VAD_FRAME_SIZE, SILENCE_THRESHOLD).is_none() {
        return Err(PreprocessError::NoVoiceDetected);
    }

    match find_voiced_range(&buffer, SILENCE_THRESHOLD) {
        Some((start, length)) => {
            let (start, length) = expand_range(start, length, TRIM_MARGIN, buffer.len());

            Ok(buffer[start..start + length].to_vec())
        }
        None => Err(PreprocessError::NoVoiceDetected),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 前後が無音、中央が有音のサンプル列
    fn build_samples(total: usize, voiced_start: usize, voiced_end: usize, amplitude: f32) -> Vec<f32> {
        (0..total)
            .map(|i| {
                if (voiced_start..voiced_end).contains(&i) {
                    if i % 2 == 0 {
                        amplitude
                    } else {
                        -amplitude
                    }
                } else {
                    0.001
                }
            })
            .collect()
    }

    #[test]
    fn 前後の無音を除いた範囲が返る() {
        let samples = build_samples(100, 30, 70, 0.5);

        let result = find_voiced_range(&samples, 0.02);

        assert_eq!(result, Some((30, 40)));
    }

    #[test]
    fn 全区間が無音なら_none_が返る() {
        let samples = vec![0.001_f32; 100];

        let result = find_voiced_range(&samples, 0.02);

        assert_eq!(result, None);
    }

    #[test]
    fn 返された範囲が配列に収まっている() {
        let samples: Vec<f32> = (0..100)
            .map(|i| if i % 2 == 0 { 0.5 } else { -0.5 })
            .collect();

        let (start, length) = find_voiced_range(&samples, 0.02).expect("有音区間が検出されるはず");

        let voiced = &samples[start..start + length];

        assert_eq!(voiced.len(), length);
        assert!(start + length <= samples.len());
    }

    #[test]
    fn 空のデータでも安全に扱える() {
        let samples: Vec<f32> = Vec::new();

        assert_eq!(find_voiced_range(&samples, 0.02), None);
        assert_eq!(find_speech_range(&samples, VAD_FRAME_SIZE, 0.02), None);
        assert_eq!(preprocess(&samples), Err(PreprocessError::NoVoiceDetected));
    }

    #[test]
    fn 発話区間が検出される() {
        let samples = build_samples(1600, 320, 1280, 0.5);

        let result = find_speech_range(&samples, 320, 0.02);

        assert_eq!(result, Some((320, 960)));
    }

    #[test]
    fn 音量が目標値に揃う() {
        let mut quiet: Vec<f32> = (0..1000)
            .map(|i| if i % 2 == 0 { 0.02 } else { -0.02 })
            .collect();

        let applied = apply_volume_normalize(&mut quiet, 0.1, 10.0);

        let rms = (quiet.iter().map(|s| s * s).sum::<f32>() / quiet.len() as f32).sqrt();

        assert!(applied);
        assert!((rms - 0.1).abs() < 0.01);
    }

    #[test]
    fn マージンの分だけ範囲が広がる() {
        let (start, length) = expand_range(1000, 2000, 160, 5000);

        assert_eq!(start, 840);
        assert_eq!(length, 2320);
    }

    #[test]
    fn マージンが配列の外に出ない() {
        let (start, length) = expand_range(50, 100, 160, 200);

        assert_eq!(start, 0);
        assert_eq!(length, 200);
    }

    #[test]
    fn 前処理で無音がカットされる() {
        let samples = build_samples(16000, 4000, 12000, 0.3);

        let result = preprocess(&samples).expect("発話が検出されるはず");

        assert!(result.len() < samples.len());
        assert!(result.len() >= 8000);
    }

    #[test]
    fn 無音のみの録音はエラーになる() {
        let samples = vec![0.0001_f32; 16000];

        let result = preprocess(&samples);

        assert_eq!(result, Err(PreprocessError::NoVoiceDetected));
    }
}