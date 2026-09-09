// apps/desktop/src-tauri/src/japanese_input.rs

// 日本語IMEの有効化
#[cfg(windows)]
pub fn enable(window: &tauri::WebviewWindow) -> Result<bool, String> {
    use std::mem::size_of;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, GetKeyboardLayout, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
        KEYEVENTF_KEYUP, VK_CONTROL, VK_IME_ON, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };

    let hwnd = window.hwnd().map_err(|error| error.to_string())?;

    unsafe {
        // 操作対象のウィンドウ
        if GetForegroundWindow() != hwnd.0 as _ {
            return Ok(false);
        }

        // 使用中の入力言語
        let thread_id = GetWindowThreadProcessId(hwnd.0 as _, std::ptr::null_mut());
        let layout = GetKeyboardLayout(thread_id);

        if (layout as usize & 0xffff) != 0x0411 {
            return Ok(false);
        }

        // 修飾キーの押下状態
        for key in [VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN] {
            if GetAsyncKeyState(i32::from(key)) < 0 {
                return Ok(false);
            }
        }

        // IMEオンキーの押下と解放
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_IME_ON,
                        wScan: 0,
                        dwFlags: 0,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_IME_ON,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];

        let sent = SendInput(
            inputs.len() as u32,
            inputs.as_ptr(),
            size_of::<INPUT>() as i32,
        );

        if sent != inputs.len() as u32 {
            return Err("日本語入力への切り替え操作を送信できませんでした".to_string());
        }
    }

    Ok(true)
}

// Windows以外の入力操作
#[cfg(not(windows))]
pub fn enable(_window: &tauri::WebviewWindow) -> Result<bool, String> {
    Ok(false)
}
