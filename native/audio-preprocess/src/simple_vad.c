// native/audio-preprocess/src/simple_vad.c
#include "audio_preprocess.h"

#include <math.h>

// 1フレーム分の音量を、RMS(二乗平均平方根)で求める
static float frame_rms(const float *frame, size_t frame_size) {
    float sum_of_squares = 0.0f;
    for (size_t i = 0; i < frame_size; i++) {
        sum_of_squares += frame[i] * frame[i];
    }
    return sqrtf(sum_of_squares / (float)frame_size);
}

int detect_voice_activity(const float *samples, size_t sample_count,
                          size_t frame_size, float threshold,
                          size_t *out_start, size_t *out_length) {
    // NULLポインタは参照する前に弾く
    if (samples == NULL || out_start == NULL || out_length == NULL) {
        return 0;
    }

    // 計算が成立しない条件を弾く
    if (sample_count == 0 || frame_size == 0 || frame_size > sample_count) {
        *out_start = 0;
        *out_length = 0;
        return 0;
    }

    const size_t frame_count = sample_count / frame_size;

    // フレームごとに音量を見て、最初と最後の発話位置を記録する
    int found = 0;
    size_t first_frame = 0;
    size_t last_frame = 0;

    for (size_t i = 0; i < frame_count; i++) {
        const float rms = frame_rms(&samples[i * frame_size], frame_size);
        if (rms < threshold) {
            continue;
        }

        if (found == 0) {
            first_frame = i;
            found = 1;
        }
        last_frame = i;
    }

    // 一度も閾値を超えなければ、無音のみの録音とみなす
    if (found == 0) {
        *out_start = 0;
        *out_length = 0;
        return 0;
    }

    // フレーム番号をサンプル位置に変換する
    *out_start = first_frame * frame_size;
    *out_length = (last_frame - first_frame + 1) * frame_size;
    return 1;
}