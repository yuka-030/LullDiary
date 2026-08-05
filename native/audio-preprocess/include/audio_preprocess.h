// native/audio-preprocess/include/audio_preprocess.h
#ifndef AUDIO_PREPROCESS_H
#define AUDIO_PREPROCESS_H

#include <stddef.h>

/*
 * 録音データの前後にある無音区間をトリミングする。
 *
 * samples      入力サンプル列(-1.0〜1.0に正規化されたモノラルPCM)
 * sample_count 入力サンプル数
 * threshold    無音とみなす振幅の閾値(例: 0.02)
 * out_start    有音区間の開始位置を受け取る
 * out_length   有音区間の長さを受け取る
 *
 * 戻り値: 有音区間が見つかれば 1、全区間が無音なら 0
 */
int trim_silence(const float *samples, size_t sample_count, float threshold,
                 size_t *out_start, size_t *out_length);

/*
 * 音量の変化から発話区間を検出する簡易VAD。
 *
 * 一定サンプル数(フレーム)ごとにRMSを求め、閾値を超えたフレームを
 * 発話中とみなす。サンプル単位で判定すると発話中の一瞬の谷間で
 * 区切られてしまうため、フレーム単位で平均をとる。
 *
 * samples      入力サンプル列(-1.0〜1.0に正規化されたモノラルPCM)
 * sample_count 入力サンプル数
 * frame_size   1フレームあたりのサンプル数(例: 16kHzで320 = 20ms)
 * threshold    発話とみなすRMSの閾値(例: 0.02)
 * out_start    発話区間の開始位置(サンプル単位)を受け取る
 * out_length   発話区間の長さ(サンプル単位)を受け取る
 *
 * 戻り値: 発話区間が見つかれば 1、無音のみなら 0
 */
 int detect_voice_activity(const float *samples, size_t sample_count, size_t frame_size, float threshold, size_t *out_start, size_t *out_length);

#endif