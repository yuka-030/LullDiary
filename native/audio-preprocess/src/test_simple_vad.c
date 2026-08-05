// native/audio-preprocess/src/test_simple_vad.c
#include "audio_preprocess.h"

#include <stdio.h>

#define SAMPLE_COUNT 1600
#define FRAME_SIZE 320
#define THRESHOLD 0.02f

// フレーム1〜3が発話、それ以外は無音のサンプル列を作る
static void build_voiced_samples(float *samples) {
    for (size_t i = 0; i < SAMPLE_COUNT; i++) {
        const size_t frame = i / FRAME_SIZE;
        if (frame >= 1 && frame <= 3) {
            samples[i] = (i % 2 == 0) ? 0.5f : -0.5f;
        } else {
            samples[i] = 0.001f;
        }
    }
}

// 全区間が無音のサンプル列を作る
static void build_silent_samples(float *samples) {
    for (size_t i = 0; i < SAMPLE_COUNT; i++) {
        samples[i] = 0.001f;
    }
}

// 発話区間が正しく検出されるか
static int test_voiced(void) {
    float samples[SAMPLE_COUNT];
    build_voiced_samples(samples);

    size_t start = 0;
    size_t length = 0;
    const int found = detect_voice_activity(samples, SAMPLE_COUNT, FRAME_SIZE,
                                            THRESHOLD, &start, &length);

    printf("[voiced] found:  %d (expected: 1)\n", found);
    printf("[voiced] start:  %zu (expected: 320)\n", start);
    printf("[voiced] length: %zu (expected: 960)\n", length);

    return (found == 1 && start == 320 && length == 960) ? 1 : 0;
}

// 無音のみの録音が正しく判定されるか
static int test_silent(void) {
    float samples[SAMPLE_COUNT];
    build_silent_samples(samples);

    size_t start = 0;
    size_t length = 0;
    const int found = detect_voice_activity(samples, SAMPLE_COUNT, FRAME_SIZE,
                                            THRESHOLD, &start, &length);

    printf("[silent] found:  %d (expected: 0)\n", found);
    printf("[silent] length: %zu (expected: 0)\n", length);

    return (found == 0 && length == 0) ? 1 : 0;
}

int main(void) {
    const int voiced_ok = test_voiced();
    const int silent_ok = test_silent();

    if (voiced_ok == 1 && silent_ok == 1) {
        printf("=> PASS\n");
        return 0;
    }

    printf("=> FAIL\n");
    return 1;
}