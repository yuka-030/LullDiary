// apps/desktop/src/screens/BookshelfScreen.tsx
import { useCallback, useEffect, useState } from 'react'
import BookSpine from '../components/BookSpine'
import EntryFilter from '../components/EntryFilter'
import PageTurningBook from '../components/PageTurningBook'
import { fetchEntries } from '../lib/bookshelfClient'
import type { Entry, EntryFilter as Filter, MonthlyBook } from '../lib/entryTypes'
import { collectYears, groupByMonth } from '../lib/entryTypes'

type Props = {
  // 最初に開く月(YYYY-MM)
  initialMonth?: string
  // ホーム画面への遷移
  onBack: () => void
  // 日記を選んだときの処理
  onSelectEntry: (entry: Entry, month: string) => void
}

// 見開き1ページあたりの日付の数
const DATES_PER_PAGE = 7

// 一度に表示する段の数
const SHELVES_PER_PAGE = 3

// 年ごとにまとめた段
type YearShelf = {
  year: number
  books: MonthlyBook[]
}

export default function BookshelfScreen({ initialMonth, onBack, onSelectEntry }: Props) {
  const [filter, setFilter] = useState<Filter>({ emotions: [] })
  const [books, setBooks] = useState<MonthlyBook[]>([])
  // 開いている月(YYYY-MM)
  const [openedMonth, setOpenedMonth] = useState<string | null>(initialMonth ?? null)
  // 日付リストの表示ページ
  const [datePage, setDatePage] = useState(0)
  // 本棚の表示ページ
  const [shelfPage, setShelfPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const years = collectYears(books)
  const openedBook = books.find((book) => book.month === openedMonth) ?? null

  // 年と月で絞り込んだ本
  const visibleBooks = books.filter((book) => {
    if (filter.year !== undefined && book.year !== filter.year) {
      return false
    }

    if (filter.month !== undefined && book.monthNumber !== filter.month) {
      return false
    }

    return true
  })

  // 年ごとの段
  const shelves: YearShelf[] = []

  for (const book of visibleBooks) {
    const shelf = shelves.find((item) => item.year === book.year)

    if (shelf) {
      shelf.books.push(book)
    } else {
      shelves.push({ year: book.year, books: [book] })
    }
  }

  shelves.sort((a, b) => b.year - a.year)

  const shelfPages: YearShelf[][] = []

  for (let index = 0; index < shelves.length; index += SHELVES_PER_PAGE) {
    shelfPages.push(shelves.slice(index, index + SHELVES_PER_PAGE))
  }

  const currentShelves = shelfPages[shelfPage] ?? []

  // 空の段を含めた表示用の段
  const filledShelves: (YearShelf | null)[] = []

  for (let index = 0; index < SHELVES_PER_PAGE; index += 1) {
    filledShelves.push(currentShelves[index] ?? null)
  }

  // シーンと感情に合う日記の取得
  const loadEntries = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const entries = await fetchEntries(filter)
      const grouped = groupByMonth(entries)

      setBooks(grouped)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  // 表示ページの範囲の補正
  useEffect(() => {
    setShelfPage((page) => (page < shelfPages.length ? page : 0))
  }, [shelfPages.length])

  // 本を開く
  function handleOpenBook(book: MonthlyBook) {
    setOpenedMonth(book.month)
    setDatePage(0)
  }

  // 本を閉じる
  function handleCloseBook() {
    setOpenedMonth(null)
    setDatePage(0)
  }

  // 見開き単位の日付
  const datePages: Entry[][] = []

  if (openedBook) {
    const sorted = [...openedBook.entries].sort((a, b) => a.created_at.localeCompare(b.created_at))

    for (let index = 0; index < sorted.length; index += DATES_PER_PAGE * 2) {
      datePages.push(sorted.slice(index, index + DATES_PER_PAGE * 2))
    }
  }

  const currentDates = datePages[datePage] ?? []
  const leftDates = currentDates.slice(0, DATES_PER_PAGE)
  const rightDates = currentDates.slice(DATES_PER_PAGE)

  // 日付の表示
  function formatDate(entry: Entry) {
    const date = new Date(entry.created_at)

    return `${date.getDate()}日`
  }

  // 選んだ月の見開き
  if (openedBook) {
    return (
      <main className="story-screen">
        <p className="book-outer-heading">
          {openedBook.year}年{openedBook.monthNumber}月
        </p>

        <div className="story-open-stage entry-detail-stage">
          <PageTurningBook
            className="story-open-book"
            pageProgress={0}
            showLeftLines={false}
            showRightLines={false}
          />

          <div className="story-book-content">
            <div className="bookshelf-date-page bookshelf-date-page-left">
              <ul className="bookshelf-date-list">
                {leftDates.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onSelectEntry(entry, openedBook.month)}
                      className="bookshelf-date-item"
                    >
                      <span className="bookshelf-date-day">{formatDate(entry)}</span>
                      <span className="bookshelf-date-excerpt">
                        {entry.story_text.slice(0, 18)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bookshelf-date-page bookshelf-date-page-right">
              <ul className="bookshelf-date-list">
                {rightDates.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onSelectEntry(entry, openedBook.month)}
                      className="bookshelf-date-item"
                    >
                      <span className="bookshelf-date-day">{formatDate(entry)}</span>
                      <span className="bookshelf-date-excerpt">
                        {entry.story_text.slice(0, 18)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* ページの重なり */}
              {datePage < datePages.length - 1 && <span className="bookshelf-page-hint" />}
            </div>
          </div>
        </div>

        <div className="story-actions story-actions-stacked">
          <div className="story-actions-line">
            <button
              type="button"
              onClick={() => setDatePage((page) => Math.max(0, page - 1))}
              disabled={datePage === 0}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              前のページ
            </button>

            <span className="font-body text-txt2 text-sm">
              {datePages.length === 0 ? '0 / 0' : `${datePage + 1} / ${datePages.length}`}
            </span>

            <button
              type="button"
              onClick={() => setDatePage((page) => Math.min(datePages.length - 1, page + 1))}
              disabled={datePage >= datePages.length - 1}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              次のページ
            </button>
          </div>

          <div className="story-actions-line">
            <button type="button" onClick={handleCloseBook} className="back-link">
              ← 本棚にもどる
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="bookshelf-screen">
      <EntryFilter filter={filter} years={years} onChange={setFilter} />

      {errorMessage && <p className="bookshelf-error">{errorMessage}</p>}

      <div className="bookshelf-frame">
        {isLoading || visibleBooks.length === 0 ? (
          <p className="bookshelf-empty">{isLoading ? 'よみこんでいるよ…' : 'まだ本がないよ'}</p>
        ) : null}

        {filledShelves.map((shelf, shelfIndex) => (
          <div key={shelfIndex} className="bookshelf-row">
            {shelf && <span className="bookshelf-row-year">{shelf.year}年</span>}

            {shelf?.books.map((book, bookIndex) => (
              <BookSpine
                key={book.month}
                monthNumber={book.monthNumber}
                variant={(bookIndex % 3) / 2}
                onSelect={() => handleOpenBook(book)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="bookshelf-actions">
        {shelfPages.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setShelfPage((page) => Math.max(0, page - 1))}
              disabled={shelfPage === 0}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-5 py-1.5 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              前の本棚
            </button>

            <span className="font-body text-txt2 text-sm">
              {shelfPage + 1} / {shelfPages.length}
            </span>

            <button
              type="button"
              onClick={() => setShelfPage((page) => Math.min(shelfPages.length - 1, page + 1))}
              disabled={shelfPage >= shelfPages.length - 1}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-5 py-1.5 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              次の本棚
            </button>
          </>
        )}

        <button type="button" onClick={onBack} className="back-link">
          ← ホームにもどる
        </button>
      </div>
    </main>
  )
}
