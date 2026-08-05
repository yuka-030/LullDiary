// native/audio-preprocess/src/test_silence_trim.c
#include "audio_preprocess.h"

#include <stdio.h>

#define SAMPLE_COUNT 100
#define THRESHOLD 0.02f

/* 前後に無音、中央に有音を持つテスト用のサンプル列を作る */
static void build_samples(float *samples) {
    for (size_t i = 0; i < SAMPLE_COUNT; i++) {
        if (i >= 30 && i < 70) {
            /* 有音区間。正負に振れる波形を模す */
            samples[i] = (i % 2 == 0) ? 0.5f : -0.5f;
        } else {
            /* 無音区間。完全な0ではなく、わずかなノイズを入れる */
            samples[i] = 0.001f;
        }
    }
}

int main(void) {
    float samples[SAMPLE_COUNT];
    build_samples(samples);

    size_t start = 0;
    size_t length = 0;
    int found = trim_silence(samples, SAMPLE_COUNT, THRESHOLD, &start, &length);

    printf("found:  %d\n", found);
    printf("start:  %zu (expected: 30)\n", start);
    printf("length: %zu (expected: 40)\n", length);

    if (found == 1 && start == 30 && length == 40) {
        printf("=> PASS\n");
        return 0;
    }

    printf("=> FAIL\n");
    return 1;
}