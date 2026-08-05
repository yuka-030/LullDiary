// native/audio-preprocess/include/audio_preprocess.h
#ifndef AUDIO_PREPROCESS_H
#define AUDIO_PREPROCESS_H

#include <stddef.h>

/*
 * 録音データの前後にある無音区間をトリミングする。
 *
 * samples      入力サンプル列(-1.0〜1.0に正規化されたモノラルPCM)
 * sample_count 入力サンプル数
 * threshold    無音とみなす振幅の閾値
 * out_start    有音区間の開始位置を受け取る
 * out_length   有音区間の長さを受け取る
 *
 * 戻り値: 有音区間が見つかれば 1、全区間が無音なら 0
 */
int trim_silence(const float *samples, size_t sample_count, float threshold,
                 size_t *out_start, size_t *out_length);

#endif