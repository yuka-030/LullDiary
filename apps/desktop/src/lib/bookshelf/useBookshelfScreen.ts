// apps/desktop/src/lib/bookshelf/useBookshelfScreen.ts
import { useCallback, useEffect, useState } from 'react'
import { fetchEntries } from './bookshelfClient'
import type { Entry, EntryFilter as Filter, MonthlyBook } from './entryTypes'
import { collectYears, groupByMonth } from './entryTypes'

// 見開き1ページあたりの日付の数
const DATES_PER_PAGE = 7

// 一度に表示する段の数
const SHELVES_PER_PAGE = 3

// 年ごとにまとめた段
type YearShelf = {
  year: number
  books: MonthlyBook[]
}

type Options = {
  // 最初に開く月(YYYY-MM)
  initialMonth?: string
}

// 日付の表示
export function formatEntryDay(entry: Entry): string {
  const date = new Date(entry.created_at)

  return `${date.getDate()}日`
}

export function useBookshelfScreen({ initialMonth }: Options) {
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
  const openBook = useCallback((book: MonthlyBook) => {
    setOpenedMonth(book.month)
    setDatePage(0)
  }, [])

  // 本を閉じる
  const closeBook = useCallback(() => {
    setOpenedMonth(null)
    setDatePage(0)
  }, [])

  // 本棚の前のページへ
  const goToPreviousShelfPage = useCallback(() => {
    setShelfPage((page) => Math.max(0, page - 1))
  }, [])

  // 本棚の次のページへ
  const goToNextShelfPage = useCallback(() => {
    setShelfPage((page) => Math.min(shelfPages.length - 1, page + 1))
  }, [shelfPages.length])

  // 見開き単位の日付
  const datePages: Entry[][] = []

  if (openedBook) {
    const sorted = [...openedBook.entries].sort((a, b) => a.created_at.localeCompare(b.created_at))

    for (let index = 0; index < sorted.length; index += DATES_PER_PAGE * 2) {
      datePages.push(sorted.slice(index, index + DATES_PER_PAGE * 2))
    }
  }

  // 日付リストの前のページへ
  const goToPreviousDatePage = useCallback(() => {
    setDatePage((page) => Math.max(0, page - 1))
  }, [])

  // 日付リストの次のページへ
  const goToNextDatePage = useCallback(() => {
    setDatePage((page) => Math.min(datePages.length - 1, page + 1))
  }, [datePages.length])

  const currentDates = datePages[datePage] ?? []
  const leftDates = currentDates.slice(0, DATES_PER_PAGE)
  const rightDates = currentDates.slice(DATES_PER_PAGE)

  // 画面に渡す状態と操作
  return {
    filter,
    setFilter,
    years,
    isLoading,
    errorMessage,
    hasVisibleBooks: visibleBooks.length > 0,
    filledShelves,
    shelfPage,
    shelfPageCount: shelfPages.length,
    isFirstShelfPage: shelfPage === 0,
    isLastShelfPage: shelfPage >= shelfPages.length - 1,
    goToPreviousShelfPage,
    goToNextShelfPage,
    openedBook,
    openBook,
    closeBook,
    datePage,
    datePageCount: datePages.length,
    isFirstDatePage: datePage === 0,
    isLastDatePage: datePage >= datePages.length - 1,
    goToPreviousDatePage,
    goToNextDatePage,
    leftDates,
    rightDates,
  }
}
