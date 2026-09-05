// apps/desktop/src/screens/BookshelfScreen.tsx
import BookSpine from '../components/bookshelf/BookSpine'
import EntryFilter from '../components/bookshelf/EntryFilter'
import PageTurningBook from '../components/shared/PageTurningBook'
import type { Entry } from '../lib/bookshelf/entryTypes'
import { formatEntryDay, useBookshelfScreen } from '../lib/bookshelf/useBookshelfScreen'

type Props = {
  // 最初に開く月(YYYY-MM)
  initialMonth?: string
  // ホーム画面への遷移
  onBack: () => void
  // 日記を選んだときの処理
  onSelectEntry: (entry: Entry, month: string) => void
}

export default function BookshelfScreen({ initialMonth, onBack, onSelectEntry }: Props) {
  const {
    filter,
    setFilter,
    years,
    isLoading,
    errorMessage,
    hasVisibleBooks,
    filledShelves,
    shelfPage,
    shelfPageCount,
    isFirstShelfPage,
    isLastShelfPage,
    goToPreviousShelfPage,
    goToNextShelfPage,
    openedBook,
    openBook,
    closeBook,
    datePage,
    datePageCount,
    isFirstDatePage,
    isLastDatePage,
    goToPreviousDatePage,
    goToNextDatePage,
    leftDates,
    rightDates,
  } = useBookshelfScreen({ initialMonth })

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
                      <span className="bookshelf-date-day">{formatEntryDay(entry)}</span>
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
                      <span className="bookshelf-date-day">{formatEntryDay(entry)}</span>
                      <span className="bookshelf-date-excerpt">
                        {entry.story_text.slice(0, 18)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* ページの重なり */}
              {!isLastDatePage && <span className="bookshelf-page-hint" />}
            </div>
          </div>
        </div>

        <div className="story-actions story-actions-stacked">
          <div className="story-actions-line">
            <button
              type="button"
              onClick={goToPreviousDatePage}
              disabled={isFirstDatePage}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              前のページ
            </button>

            <span className="font-body text-txt2 text-sm">
              {datePageCount === 0 ? '0 / 0' : `${datePage + 1} / ${datePageCount}`}
            </span>

            <button
              type="button"
              onClick={goToNextDatePage}
              disabled={isLastDatePage}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              次のページ
            </button>
          </div>

          <div className="story-actions-line">
            <button type="button" onClick={closeBook} className="back-link">
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
        {isLoading || !hasVisibleBooks ? (
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
                onSelect={() => openBook(book)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="bookshelf-actions">
        {shelfPageCount > 1 && (
          <>
            <button
              type="button"
              onClick={goToPreviousShelfPage}
              disabled={isFirstShelfPage}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-5 py-1.5 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              前の本棚
            </button>

            <span className="font-body text-txt2 text-sm">
              {shelfPage + 1} / {shelfPageCount}
            </span>

            <button
              type="button"
              onClick={goToNextShelfPage}
              disabled={isLastShelfPage}
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
