// apps/desktop/src-tauri/build.rs

fn main() {
    build_audio_preprocess();
    tauri_build::build()
}

// 音声前処理の自作Cライブラリをビルドし、静的にリンクする。
// 共有ライブラリ(.dll)を別途配布する方式だと配置場所の管理が必要になるため、
// Rustのビルドに組み込んで実行ファイルに含める形にしている。
fn build_audio_preprocess() {
    let base = "../../../native/audio-preprocess";

    cc::Build::new()
        .include(format!("{base}/include"))
        .file(format!("{base}/src/silence_trim.c"))
        .file(format!("{base}/src/simple_vad.c"))
        .file(format!("{base}/src/volume_normalize.c"))
        .compile("audio_preprocess");

    // Cのソースやヘッダが変わったときだけ再ビルドする
    println!("cargo:rerun-if-changed={base}/include/audio_preprocess.h");
    println!("cargo:rerun-if-changed={base}/src/silence_trim.c");
    println!("cargo:rerun-if-changed={base}/src/simple_vad.c");
    println!("cargo:rerun-if-changed={base}/src/volume_normalize.c");
}