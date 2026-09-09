// apps/desktop/src-tauri/src/lib.rs
mod audio_preprocess;
mod japanese_input;

use audio_preprocess::{preprocess, PreprocessError};

// 録音データの前処理
#[tauri::command]
fn preprocess_audio(samples: Vec<f32>) -> Result<Vec<f32>, String> {
    match preprocess(&samples) {
        Ok(processed) => Ok(processed),
        Err(PreprocessError::NoVoiceDetected) => Err("声が聞こえませんでした".to_string()),
    }
}

// 日本語入力への切り替え
#[tauri::command]
fn enable_japanese_input(window: tauri::WebviewWindow) -> Result<bool, String> {
    japanese_input::enable(&window)
}

// アプリの起動
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            preprocess_audio,
            enable_japanese_input
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
