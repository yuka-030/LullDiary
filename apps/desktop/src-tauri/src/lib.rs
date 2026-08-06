// apps/desktop/src-tauri/src/lib.rs
mod audio_preprocess;

use audio_preprocess::{preprocess, PreprocessError};

/**
 * 録音データに前処理を適用する。
 * フロントから Float32Array を受け取り、処理済みのサンプル列を返す。
 */
#[tauri::command]
fn preprocess_audio(samples: Vec<f32>) -> Result<Vec<f32>, String> {
    match preprocess(&samples) {
        Ok(processed) => Ok(processed),
        Err(PreprocessError::NoVoiceDetected) => {
            Err("声が聞き取れませんでした".to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![preprocess_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}