// native/audio-preprocess/src/volume_normalize.c
#include "audio_preprocess.h"

#include <math.h>

// 全サンプルの音量を、RMSで求める
static float overall_rms(const float *samples, size_t sample_count) {
    float sum_of_squares = 0.0f;
    for (size_t i = 0; i < sample_count; i++) {
        sum_of_squares += samples[i] * samples[i];
    }
    return sqrtf(sum_of_squares / (float)sample_count);
}

int normalize_volume(float *samples, size_t sample_count, float target_rms,
                     float max_gain) {
    // NULLポインタは参照する前に弾く
    if (samples == NULL) {
        return 0;
    }

    // 計算が成立しない条件を弾く
    if (sample_count == 0 || target_rms <= 0.0f || max_gain <= 0.0f) {
        return 0;
    }

    const float current_rms = overall_rms(samples, sample_count);

    // 実質無音なら、増幅してもノイズが大きくなるだけなので何もしない
    if (current_rms <= 0.0f) {
        return 0;
    }

    // 目標のRMSに近づける倍率を求め、上限を超えないよう抑える
    float gain = target_rms / current_rms;
    if (gain > max_gain) {
        gain = max_gain;
    }

    for (size_t i = 0; i < sample_count; i++) {
        float value = samples[i] * gain;

        // 音割れを防ぐため、表現できる範囲に収める
        if (value > 1.0f) {
            value = 1.0f;
        } else if (value < -1.0f) {
            value = -1.0f;
        }

        samples[i] = value;
    }

    return 1;
}