// apps/desktop/src-tauri/src/audio_preprocess.rs

use std::os::raw::c_int;

// 自作Cライブラリの関数宣言。
// C側の audio_preprocess.h と型・引数の順序を一致させる必要がある。
// float -> f32、size_t -> usize、int -> c_int が対応する。
unsafe extern "C" {
    fn trim_silence(
        samples: *const f32,
        sample_count: usize,
        threshold: f32,
        out_start: *mut usize,
        out_length: *mut usize,
    ) -> c_int;
}

/// 前後の無音区間を除いた、有音区間の範囲を返す。
/// 全区間が無音だった場合、または返された範囲が不正だった場合は None を返す。
pub fn find_voiced_range(samples: &[f32], threshold: f32) -> Option<(usize, usize)> {
    let mut start: usize = 0;
    let mut length: usize = 0;

    // C側はメモリを確保せず、Rustが用意した領域に結果を書き込むだけなので、
    // 解放処理は不要。samples の寿命もこの関数の呼び出し中に限られる。
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

    // C側の実装を信頼せず、返された範囲が配列に収まっているか確認する。
    // 範囲外の値をそのまま使うと、後段のスライス操作でパニックするため。
    if start.checked_add(length)? > samples.len() {
        return None;
    }

    Some((start, length))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 前後の無音を除いた範囲が返る() {
        // 前後30サンプルが無音、中央40サンプルが有音のデータを作る
        let samples: Vec<f32> = (0..100)
            .map(|i| {
                if (30..70).contains(&i) {
                    if i % 2 == 0 {
                        0.5
                    } else {
                        -0.5
                    }
                } else {
                    0.001
                }
            })
            .collect();

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

        let result = find_voiced_range(&samples, 0.02);

        assert_eq!(result, None);
    }
}