// apps/server/src/media/paths.test.ts
import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import { narrationPath, photoPath, photosDir } from './paths'

// 有効な日記ID
const ENTRY_ID = '12345678-1234-4234-8234-123456789abc'

describe('メディアの保存先', () => {
  test('有効なIDと写真名を指定した保存先を作る', () => {
    expect(path.basename(narrationPath(ENTRY_ID))).toBe(`${ENTRY_ID}.wav`)
    expect(path.basename(photosDir(ENTRY_ID))).toBe(ENTRY_ID)
    expect(path.dirname(photoPath(ENTRY_ID, 'photo1.jpg'))).toBe(photosDir(ENTRY_ID))
    expect(path.basename(photoPath(ENTRY_ID, 'photo1.jpg'))).toBe('photo1.jpg')
  })

  test('ディレクトリ移動や絶対パスを含むIDを拒否する', () => {
    for (const id of [
      '',
      '..',
      '../outside',
      '..\\outside',
      '/tmp/outside',
      'C:\\outside',
      `${ENTRY_ID}/..`,
      `${ENTRY_ID}\0`,
    ]) {
      expect(() => narrationPath(id)).toThrow('日記IDの形式が不正です')
      expect(() => photosDir(id)).toThrow('日記IDの形式が不正です')
      expect(() => photoPath(id, 'photo1.jpg')).toThrow('日記IDの形式が不正です')
    }
  })

  test('保存ルールに合わない写真名を拒否する', () => {
    for (const filename of [
      '../photo1.jpg',
      '..\\photo1.jpg',
      '/photo1.jpg',
      'C:\\photo1.jpg',
      'photo0.jpg',
      'photo1.svg',
      'photo1.jpg.html',
      'photo1.jpg\0',
    ]) {
      expect(() => photoPath(ENTRY_ID, filename)).toThrow('写真ファイル名の形式が不正です')
    }
  })
})
