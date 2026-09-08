// apps/server/src/validation/textInput.test.ts
import { describe, expect, test } from 'bun:test'
import { countInputCharacters, validateTextInput } from './textInput'

describe('テキスト入力の検証', () => {
  test('100字を許可し101字を拒否する', () => {
    expect(validateTextInput('あ'.repeat(100))).toBeNull()
    expect(validateTextInput('あ'.repeat(101))).toBe('100字以内で入力してください')
  })

  test('空文字と空白だけの入力を拒否する', () => {
    for (const text of ['', ' ', '　', '\n\t']) {
      expect(validateTextInput(text)).toBe('文字を入力してください')
    }
  })

  test('空白と改行を文字数に含める', () => {
    expect(countInputCharacters('あ い\n')).toBe(4)
    expect(validateTextInput('あ'.repeat(99) + ' \n')).toBe('100字以内で入力してください')
  })

  test('絵文字と結合文字を見た目の1文字として数える', () => {
    for (const character of ['😀', '👨‍👩‍👧‍👦', 'か\u3099']) {
      expect(countInputCharacters(character)).toBe(1)
      expect(validateTextInput(character.repeat(100))).toBeNull()
      expect(validateTextInput(character.repeat(101))).toBe('100字以内で入力してください')
    }
  })
})
