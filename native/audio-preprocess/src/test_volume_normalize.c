// native/audio-preprocess/src/test_volume_normalize.c
#include "audio_preprocess.h"

#include <math.h>
#include <stdio.h>

#define SAMPLE_COUNT 1000
#define TARGET_RMS 0.1f
#define MAX_GAIN 10.0f

// 指定した振幅で正負に振れるサンプル列を作る
static void build_samples(float *samples, float amplitude) {
    for (size_t i = 0; i < SAMPLE_COUNT; i++) {
        samples[i] = (i % 2 == 0) ? amplitude : -amplitude;
    }
}

// 全サンプルのRMSを求める
static float measure_rms(const float *samples, size_t sample_count) {
    float sum_of_squares = 0.0f;
    for (size_t i = 0; i < sample_count; i++) {
        sum_of_squares += samples[i] * samples[i];
    }
    return sqrtf(sum_of_squares / (float)sample_count);
}

// 音量差のある2つの音声が、近い音量レベルに揃うか
static int test_levels_align(void) {
    float quiet[SAMPLE_COUNT];
    float loud[SAMPLE_COUNT];
    build_samples(quiet, 0.02f);
    build_samples(loud, 0.6f);

    printf("[before] quiet rms: %.4f\n", measure_rms(quiet, SAMPLE_COUNT));
    printf("[before] loud  rms: %.4f\n", measure_rms(loud, SAMPLE_COUNT));

    const int quiet_ok = normalize_volume(quiet, SAMPLE_COUNT, TARGET_RMS, MAX_GAIN);
    const int loud_ok = normalize_volume(loud, SAMPLE_COUNT, TARGET_RMS, MAX_GAIN);

    const float quiet_rms = measure_rms(quiet, SAMPLE_COUNT);
    const float loud_rms = measure_rms(loud, SAMPLE_COUNT);

    printf("[after]  quiet rms: %.4f (expected: %.4f)\n", quiet_rms, TARGET_RMS);
    printf("[after]  loud  rms: %.4f (expected: %.4f)\n", loud_rms, TARGET_RMS);

    const float diff = fabsf(quiet_rms - loud_rms);
    printf("[after]  diff:      %.4f (expected: under 0.01)\n", diff);

    return (quiet_ok == 1 && loud_ok == 1 && diff < 0.01f) ? 1 : 0;
}

// 極端に小さい音量では、倍率の上限が効くか
static int test_max_gain(void) {
    float tiny[SAMPLE_COUNT];
    build_samples(tiny, 0.0001f);

    const int result = normalize_volume(tiny, SAMPLE_COUNT, TARGET_RMS, MAX_GAIN);
    const float rms = measure_rms(tiny, SAMPLE_COUNT);

    // 0.0001 を10倍しても 0.001 にしかならず、目標には届かない
    printf("[gain]   rms: %.4f (expected: under %.4f)\n", rms, TARGET_RMS);

    return (result == 1 && rms < TARGET_RMS) ? 1 : 0;
}

// 極端に大きい音量でも、範囲を超えないか
static int test_no_clipping(void) {
    float huge[SAMPLE_COUNT];
    build_samples(huge, 0.9f);

    normalize_volume(huge, SAMPLE_COUNT, TARGET_RMS, MAX_GAIN);

    int within_range = 1;
    for (size_t i = 0; i < SAMPLE_COUNT; i++) {
        if (huge[i] > 1.0f || huge[i] < -1.0f) {
            within_range = 0;
            break;
        }
    }

    printf("[clip]   within range: %d (expected: 1)\n", within_range);

    return within_range;
}

int main(void) {
    const int align_ok = test_levels_align();
    const int gain_ok = test_max_gain();
    const int clip_ok = test_no_clipping();

    if (align_ok == 1 && gain_ok == 1 && clip_ok == 1) {
        printf("=> PASS\n");
        return 0;
    }

    printf("=> FAIL\n");
    return 1;
}