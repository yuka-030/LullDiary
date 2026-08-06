// apps/desktop/src-tauri/src/audio_preprocess.rs

use std::os::raw::c_int;

/// whisper.cpp が前提とするサンプリングレート。フレームサイズの算出に用いる。
const SAMPLE_RATE: usize = 16_000;

/// VADのフレームサイズ。16kHz で 20ms 相当。
const VAD_FRAME_SIZE: usize = SAMPLE_RATE / 50;

/// 無音とみなす振幅の閾値。
const SILENCE_THRESHOLD: f32 = 0.02;

/// 正規化後に目標とする音量(RMS)。
const TARGET_RMS: f32 = 0.1;

/// 増幅率の上限。極端に小さい音声でノイズだけが増幅されるのを防ぐ。
const MAX_GAIN: f32 = 10.0;

/*
 * 自作Cライブラリの関数宣言。
 * C側の audio_preprocess.h と型・引数の順序を一致させる必要がある。
 * float -> f32、size_t -> usize、int -> c_int が対応する。
 */
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

/// 前処理に失敗した理由。
#[derive(Debug, PartialEq)]
pub enum PreprocessError {
    /// 発話が検出できなかった(無音のみの録音など)
    NoVoiceDetected,
}

/// 前後の無音区間を除いた、有音区間の範囲を返す。
/// 全区間が無音だった場合、または返された範囲が不正だった場合は None を返す。
pub fn find_voiced_range(samples: &[f32], threshold: f32) -> Option<(usize, usize)> {
    let mut start: usize = 0;
    let mut length: usize = 0;

    /*
     * C側はメモリを確保せず、Rustが用意した領域に結果を書き込むだけなので、
     * 解放処理は不要。samples の寿命もこの関数の呼び出し中に限られる。
     */
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

    /*
     * C側の実装を信頼せず、返された範囲が配列に収まっているか確認する。
     * 範囲外の値をそのまま使うと、後段のスライス操作でパニックするため。
     */
    if start.checked_add(length)? > samples.len() {
        return None;
    }

    Some((start, length))
}

/// 発話区間を検出する。無音のみだった場合は None を返す。
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

/// 音量を正規化する。サンプル列を直接書き換える。
pub fn apply_volume_normalize(samples: &mut [f32], target_rms: f32, max_gain: f32) -> bool {
    let applied = unsafe {
        normalize_volume(samples.as_mut_ptr(), samples.len(), target_rms, max_gain)
    };

    applied == 1
}

/**
 * 録音データに前処理を適用し、whisper.cpp に渡せる状態のサンプル列を返す。
 *
 * 音量を揃えてから発話の有無を確認し、最後に前後の無音を除く順で処理する。
 * 音量が揃っていない状態で判定すると、小さい声の録音が無音と誤判定されるため、
 * 正規化を先に行っている。
 */
pub fn preprocess(samples: &[f32]) -> Result<Vec<f32>, PreprocessError> {
    let mut buffer = samples.to_vec();

    apply_volume_normalize(&mut buffer, TARGET_RMS, MAX_GAIN);

    if find_speech_range(&buffer, VAD_FRAME_SIZE, SILENCE_THRESHOLD).is_none() {
        return Err(PreprocessError::NoVoiceDetected);
    }

    match find_voiced_range(&buffer, SILENCE_THRESHOLD) {
        Some((start, length)) => Ok(buffer[start..start + length].to_vec()),
        None => Err(PreprocessError::NoVoiceDetected),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 前後が無音、中央が有音のサンプル列を作る
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

        // 範囲外の値が返っていれば、このスライス操作でパニックする
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
        // フレーム1〜3が発話、それ以外は無音
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
    fn 前処理で無音がカットされる() {
        let samples = build_samples(16000, 4000, 12000, 0.3);

        let result = preprocess(&samples).expect("発話が検出されるはず");

        // 前後の無音が除かれているため、元より短くなる
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