// apps/desktop/src/components/bookshelf/EntryFilter.tsx
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EntryFilter as Filter } from '../../lib/bookshelf/entryTypes'
import { TAG_OPTIONS } from '../../lib/bookshelf/entryTypes'

type Props = {
  // 現在の絞り込み条件
  filter: Filter
  // 選べる年
  years: number[]
  // 絞り込み条件の変更
  onChange: (filter: Filter) => void
}

// 月の選択肢
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

// 開いている候補の種別
type OpenMenu = 'year' | 'month' | 'scene' | 'emotion' | null

export default function EntryFilter({ filter, years, onChange }: Props) {
  // 開いている候補
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  // 候補の表示位置
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  const yearButtonRef = useRef<HTMLButtonElement>(null)
  const monthButtonRef = useRef<HTMLButtonElement>(null)
  const sceneButtonRef = useRef<HTMLButtonElement>(null)
  const emotionButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 外側のクリックでの候補の閉じ込み
  useEffect(() => {
    if (openMenu === null) {
      return
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node

      if (
        yearButtonRef.current?.contains(target) ||
        monthButtonRef.current?.contains(target) ||
        sceneButtonRef.current?.contains(target) ||
        emotionButtonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }

      setOpenMenu(null)
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenu])

  // 候補の開閉
  function toggleMenu(menu: Exclude<OpenMenu, null>, button: HTMLButtonElement | null) {
    if (openMenu === menu) {
      setOpenMenu(null)
      return
    }

    if (button) {
      const rect = button.getBoundingClientRect()

      setMenuPosition({ top: rect.bottom + 6, left: rect.left })
    }

    setOpenMenu(menu)
  }

  // 年の選択
  function selectYear(year: number | undefined) {
    onChange({ ...filter, year })
    setOpenMenu(null)
  }

  // 月の選択
  function selectMonth(month: number | undefined) {
    onChange({ ...filter, month })
    setOpenMenu(null)
  }

  // シーンの選択
  function selectScene(scene: string | undefined) {
    onChange({ ...filter, scene })
    setOpenMenu(null)
  }

  // きもちの選択と解除
  function toggleEmotion(emotion: string) {
    const selected = filter.emotions.includes(emotion)

    onChange({
      ...filter,
      emotions: selected
        ? filter.emotions.filter((item) => item !== emotion)
        : [...filter.emotions, emotion],
    })
  }

  // 絞り込みの解除
  function clearFilter() {
    onChange({ year: undefined, month: undefined, scene: undefined, emotions: [] })
  }

  const hasFilter =
    filter.year !== undefined ||
    filter.month !== undefined ||
    filter.scene !== undefined ||
    filter.emotions.length > 0

  return (
    <div className="bookshelf-filter">
      <div className="bookshelf-filter-row">
        <span className="bookshelf-filter-label">いつ</span>

        <button
          ref={yearButtonRef}
          type="button"
          aria-expanded={openMenu === 'year'}
          aria-controls={openMenu === 'year' ? 'bookshelf-filter-options' : undefined}
          onClick={() => toggleMenu('year', yearButtonRef.current)}
          className="bookshelf-select"
        >
          {filter.year === undefined ? 'すべての年' : `${filter.year}年`}
        </button>

        <button
          ref={monthButtonRef}
          type="button"
          aria-expanded={openMenu === 'month'}
          aria-controls={openMenu === 'month' ? 'bookshelf-filter-options' : undefined}
          onClick={() => toggleMenu('month', monthButtonRef.current)}
          className="bookshelf-select"
        >
          {filter.month === undefined ? 'すべての月' : `${filter.month}月`}
        </button>

        <span className="bookshelf-filter-label">どこで</span>

        <button
          ref={sceneButtonRef}
          type="button"
          aria-label={`どこで：${filter.scene ?? 'すべて'}`}
          aria-expanded={openMenu === 'scene'}
          aria-controls={openMenu === 'scene' ? 'bookshelf-filter-options' : undefined}
          onClick={() => toggleMenu('scene', sceneButtonRef.current)}
          className="bookshelf-select"
        >
          {filter.scene ?? 'すべて'}
        </button>

        <span className="bookshelf-filter-label">きもち</span>

        <button
          ref={emotionButtonRef}
          type="button"
          aria-label={`きもち：${
            filter.emotions.length === 0 ? 'えらぶ' : `${filter.emotions.length}つ えらんだ`
          }`}
          aria-expanded={openMenu === 'emotion'}
          aria-controls={openMenu === 'emotion' ? 'bookshelf-filter-options' : undefined}
          onClick={() => toggleMenu('emotion', emotionButtonRef.current)}
          className="bookshelf-select"
        >
          {filter.emotions.length === 0 ? 'えらぶ' : `${filter.emotions.length}つ えらんだ`}
        </button>

        {hasFilter && (
          <button type="button" onClick={clearFilter} className="bookshelf-filter-clear">
            条件をはずす
          </button>
        )}
      </div>

      {/* 選択中のきもち */}
      {filter.emotions.length > 0 && (
        <div className="bookshelf-selected-emotions">
          {filter.emotions.map((emotion) => (
            <button
              key={emotion}
              type="button"
              aria-label={`${emotion}の絞り込みを解除`}
              onClick={() => toggleEmotion(emotion)}
              className="bookshelf-emotion-tag"
            >
              {emotion}
              <span className="bookshelf-emotion-remove" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 画面上の選択候補 */}
      {openMenu !== null &&
        createPortal(
          <div
            id="bookshelf-filter-options"
            ref={menuRef}
            className="option-menu option-menu-floating"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {openMenu === 'year' && (
              <>
                <button
                  type="button"
                  aria-pressed={filter.year === undefined}
                  onClick={() => selectYear(undefined)}
                  className={`option-menu-item ${
                    filter.year === undefined ? 'option-menu-item-active' : ''
                  }`}
                >
                  すべて
                </button>

                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    aria-pressed={filter.year === year}
                    onClick={() => selectYear(year)}
                    className={`option-menu-item ${
                      filter.year === year ? 'option-menu-item-active' : ''
                    }`}
                  >
                    {year}年
                  </button>
                ))}
              </>
            )}

            {openMenu === 'month' && (
              <>
                <button
                  type="button"
                  aria-pressed={filter.month === undefined}
                  onClick={() => selectMonth(undefined)}
                  className={`option-menu-item ${
                    filter.month === undefined ? 'option-menu-item-active' : ''
                  }`}
                >
                  すべて
                </button>

                {MONTHS.map((month) => (
                  <button
                    key={month}
                    type="button"
                    aria-pressed={filter.month === month}
                    onClick={() => selectMonth(month)}
                    className={`option-menu-item ${
                      filter.month === month ? 'option-menu-item-active' : ''
                    }`}
                  >
                    {month}月
                  </button>
                ))}
              </>
            )}

            {openMenu === 'scene' && (
              <>
                <button
                  type="button"
                  aria-pressed={filter.scene === undefined}
                  onClick={() => selectScene(undefined)}
                  className={`option-menu-item ${
                    filter.scene === undefined ? 'option-menu-item-active' : ''
                  }`}
                >
                  すべて
                </button>

                {TAG_OPTIONS.シーン.map((scene) => (
                  <button
                    key={scene}
                    type="button"
                    aria-pressed={filter.scene === scene}
                    onClick={() => selectScene(scene)}
                    className={`option-menu-item ${
                      filter.scene === scene ? 'option-menu-item-active' : ''
                    }`}
                  >
                    {scene}
                  </button>
                ))}
              </>
            )}

            {openMenu === 'emotion' &&
              TAG_OPTIONS.感情.map((emotion) => (
                <label key={emotion} className="option-menu-check">
                  <input
                    type="checkbox"
                    checked={filter.emotions.includes(emotion)}
                    onChange={() => toggleEmotion(emotion)}
                    className="option-menu-checkbox"
                  />
                  {emotion}
                </label>
              ))}
          </div>,
          document.body
        )}
    </div>
  )
}
