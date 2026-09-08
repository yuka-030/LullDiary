// apps/server/src/validation/textInput.ts
/// <reference lib="es2022.intl" />

// テキスト入力の文字数上限
export const TEXT_INPUT_LIMIT = 100

// 見た目の文字単位
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' })

// 空白と改行を含む入力文字数
export function countInputCharacters(text: string): number {
  return Array.from(segmenter.segment(text)).length
}

// テキスト入力の検証
export function validateTextInput(text: string): string | null {
  if (countInputCharacters(text) > TEXT_INPUT_LIMIT) {
    return '100字以内で入力してください'
  }

  if (text.trim().length === 0) {
    return '文字を入力してください'
  }

  return null
}
