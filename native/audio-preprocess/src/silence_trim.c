// native/audio-preprocess/src/silence_trim.c
#include "audio_preprocess.h"

#include <math.h>

int trim_silence(const float *samples, size_t sample_count, float threshold,
                 size_t *out_start, size_t *out_length) {
    if (samples == NULL || out_start == NULL || out_length == NULL) {
        return 0;
    }

    if (sample_count == 0) {
        *out_start = 0;
        *out_length = 0;
        return 0;
    }

    // 先頭から走査し、閾値を超える最初の位置を探す
    size_t start = 0;
    while (start < sample_count && fabsf(samples[start]) < threshold) {
        start++;
    }

    // 全区間が閾値未満なら、有音区間なしとみなす
    if (start == sample_count) {
        *out_start = 0;
        *out_length = 0;
        return 0;
    }

    // 末尾から走査し、閾値を超える最後の位置を探す
    size_t end = sample_count - 1;
    while (end > start && fabsf(samples[end]) < threshold) {
        end--;
    }

    *out_start = start;
    *out_length = end - start + 1;
    return 1;
}