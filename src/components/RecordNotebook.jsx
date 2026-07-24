import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { loadImageBlob } from '../services/localDb';
import styles from './RecordNotebook.module.css';

const LONG_PRESS_MS = 360;
const FAN_RADIUS = 112;
const FAN_START_DEG = 100;
const FAN_END_DEG = 174;
const FAN_SELECT_DISTANCE = 48;
const FAN_MIN_DISTANCE = 28;
const SWIPE_THRESHOLD = 44;

const formatDateLabel = (ymd) => {
  const date = new Date(`${ymd}T00:00:00`);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

const NotebookImage = memo(function NotebookImage({ imageId, onOpen }) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!imageId) {
      setImageUrl('');
      return undefined;
    }

    loadImageBlob(imageId)
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((error) => console.warn('Failed to load notebook image', error));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  if (!imageUrl) return null;

  return (
    <button
      type="button"
      className={styles.imageButton}
      onClick={(event) => onOpen([imageUrl], 0, event.currentTarget)}
      aria-label="記録画像を拡大表示"
    >
      <img className={styles.image} src={imageUrl} alt="記録画像" />
    </button>
  );
});

function RecordNotebook({
  records,
  initialDate,
  colorOptions,
  sanitizeHtml,
  onBack,
  onDateChange,
  onEdit,
  onDelete,
  onOpenImage,
}) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [filterColor, setFilterColor] = useState(null);
  const [fanState, setFanState] = useState({ open: false, activeColor: null });
  const [pageMotion, setPageMotion] = useState({
    offset: 0,
    dragging: false,
    phase: 'idle',
  });
  const pageStackRef = useRef(null);
  const pointerRef = useRef({
    id: null,
    timer: null,
    originX: 0,
    originY: 0,
    activeColor: null,
  });
  const swipeRef = useRef({
    id: null,
    startX: 0,
    startY: 0,
    axis: null,
  });
  const motionRef = useRef({
    nextIndex: null,
    exitOffset: 0,
    frameOne: null,
    frameTwo: null,
  });

  const allDates = useMemo(
    () =>
      Object.keys(records)
        .filter((ymd) => Array.isArray(records[ymd]?.records) && records[ymd].records.length > 0)
        .sort((a, b) => b.localeCompare(a)),
    [records]
  );
  const filteredDates = useMemo(
    () =>
      allDates.filter(
        (ymd) =>
          !filterColor || records[ymd].records.some((record) => record.color === filterColor)
      ),
    [allDates, filterColor, records]
  );
  const fanOptions = useMemo(
    () =>
      colorOptions.map((option, index) => {
        const step =
          colorOptions.length > 1
            ? (FAN_END_DEG - FAN_START_DEG) / (colorOptions.length - 1)
            : 0;
        const radians = ((FAN_START_DEG + step * index) * Math.PI) / 180;
        return {
          ...option,
          x: Math.cos(radians) * FAN_RADIUS,
          y: Math.sin(radians) * FAN_RADIUS,
        };
      }),
    [colorOptions]
  );

  useEffect(() => {
    if (filteredDates.length === 0) return;
    if (!filteredDates.includes(currentDate)) {
      setCurrentDate(filteredDates[0]);
    }
  }, [currentDate, filteredDates]);

  useEffect(() => {
    if (currentDate) onDateChange(currentDate);
  }, [currentDate, onDateChange]);

  useEffect(
    () => () => {
      if (pointerRef.current.timer) clearTimeout(pointerRef.current.timer);
      pointerRef.current = {
        id: null,
        timer: null,
        originX: 0,
        originY: 0,
        activeColor: null,
      };
      swipeRef.current = { id: null, startX: 0, startY: 0, axis: null };
      if (motionRef.current.frameOne) cancelAnimationFrame(motionRef.current.frameOne);
      if (motionRef.current.frameTwo) cancelAnimationFrame(motionRef.current.frameTwo);
      motionRef.current = {
        nextIndex: null,
        exitOffset: 0,
        frameOne: null,
        frameTwo: null,
      };
    },
    []
  );

  const pageIndex = filteredDates.indexOf(currentDate);
  const dayRecords = pageIndex >= 0 ? records[currentDate]?.records || [] : [];
  const visibleRecords = dayRecords
    .map((record, originalIndex) => ({ record, originalIndex }))
    .filter(({ record }) => !filterColor || record.color === filterColor);

  const clearFilterPointer = () => {
    if (pointerRef.current.timer) clearTimeout(pointerRef.current.timer);
    pointerRef.current = {
      id: null,
      timer: null,
      originX: 0,
      originY: 0,
      activeColor: null,
    };
    setFanState({ open: false, activeColor: null });
  };

  const handleFilterDown = (event) => {
    if (pageMotion.phase !== 'idle') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      id: event.pointerId,
      originX: rect.left + rect.width / 2,
      originY: rect.top + rect.height / 2,
      activeColor: null,
      timer: setTimeout(() => {
        pointerRef.current.timer = null;
        navigator.vibrate?.(10);
        setFanState({ open: true, activeColor: null });
      }, LONG_PRESS_MS),
    };
  };

  const handleFilterMove = (event) => {
    if (pointerRef.current.id !== event.pointerId || !fanState.open) return;
    event.preventDefault();
    const { originX, originY } = pointerRef.current;
    if (Math.hypot(event.clientX - originX, event.clientY - originY) < FAN_MIN_DISTANCE) {
      pointerRef.current.activeColor = null;
      setFanState((previous) => ({ ...previous, activeColor: null }));
      return;
    }
    let nearest = null;
    let distance = Infinity;
    fanOptions.forEach((option) => {
      const candidateDistance = Math.hypot(
        event.clientX - (originX + option.x),
        event.clientY - (originY + option.y)
      );
      if (candidateDistance < distance) {
        nearest = option;
        distance = candidateDistance;
      }
    });
    const activeColor = distance <= FAN_SELECT_DISTANCE ? nearest?.color || null : null;
    pointerRef.current.activeColor = activeColor;
    setFanState((previous) => ({
      ...previous,
      activeColor,
    }));
  };

  const handleFilterEnd = (event) => {
    if (pointerRef.current.id !== event.pointerId) return;
    const wasTap = Boolean(pointerRef.current.timer);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasTap) setFilterColor(null);
    else if (pointerRef.current.activeColor) setFilterColor(pointerRef.current.activeColor);
    clearFilterPointer();
  };

  const handlePageDown = (event) => {
    if (event.target.closest('button') || pageMotion.phase !== 'idle') return;
    swipeRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePageMove = (event) => {
    const swipe = swipeRef.current;
    if (swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;

    if (!swipe.axis && Math.hypot(dx, dy) >= 8) {
      swipe.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical';
    }
    if (swipe.axis !== 'horizontal') return;

    event.preventDefault();
    const isLatestEdge = pageIndex === 0 && dx > 0;
    const isOldestEdge = pageIndex === filteredDates.length - 1 && dx < 0;
    const resistedOffset = isLatestEdge || isOldestEdge ? dx * 0.24 : dx;
    setPageMotion({ offset: resistedOffset, dragging: true, phase: 'idle' });
  };

  const resetSwipe = () => {
    swipeRef.current = { id: null, startX: 0, startY: 0, axis: null };
  };

  const returnPageToOrigin = () => {
    if (Math.abs(pageMotion.offset) < 0.5) {
      setPageMotion({ offset: 0, dragging: false, phase: 'idle' });
      return;
    }
    setPageMotion({ offset: 0, dragging: false, phase: 'return' });
  };

  const handlePageEnd = (event) => {
    const swipe = swipeRef.current;
    if (swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetSwipe();

    const isHorizontal = swipe.axis === 'horizontal';
    const passedThreshold = Math.abs(dx) >= SWIPE_THRESHOLD;
    const nextIndex = pageIndex + (dx < 0 ? 1 : -1);
    const hasNextPage = nextIndex >= 0 && nextIndex < filteredDates.length;
    if (!isHorizontal || !passedThreshold || Math.abs(dx) <= Math.abs(dy) * 1.2 || !hasNextPage) {
      returnPageToOrigin();
      return;
    }

    const exitDistance = (pageStackRef.current?.offsetWidth || window.innerWidth) + 48;
    const exitOffset = dx < 0 ? -exitDistance : exitDistance;
    motionRef.current.nextIndex = nextIndex;
    motionRef.current.exitOffset = exitOffset;
    setPageMotion({ offset: exitOffset, dragging: false, phase: 'exit' });
  };

  const cancelPagePointer = (event) => {
    if (swipeRef.current.id !== event.pointerId) return;
    resetSwipe();
    returnPageToOrigin();
  };

  const handlePageTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;

    if (pageMotion.phase === 'exit') {
      const nextDate = filteredDates[motionRef.current.nextIndex];
      if (!nextDate) {
        motionRef.current.nextIndex = null;
        setPageMotion({ offset: 0, dragging: false, phase: 'idle' });
        return;
      }

      const entranceOffset = -motionRef.current.exitOffset;
      setCurrentDate(nextDate);
      setPageMotion({ offset: entranceOffset, dragging: false, phase: 'prepare' });
      motionRef.current.frameOne = requestAnimationFrame(() => {
        motionRef.current.frameTwo = requestAnimationFrame(() => {
          setPageMotion({ offset: 0, dragging: false, phase: 'enter' });
        });
      });
      return;
    }

    if (pageMotion.phase === 'enter' || pageMotion.phase === 'return') {
      motionRef.current.nextIndex = null;
      motionRef.current.exitOffset = 0;
      setPageMotion({ offset: 0, dragging: false, phase: 'idle' });
    }
  };

  return (
    <section className={styles.screen} aria-label="All Records">
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onBack} aria-label="カレンダーに戻る">
          <span aria-hidden="true">‹</span>
        </button>
        <h1 className={styles.title}>All Records</h1>
      </header>

      <div className={styles.notebookArea}>
        <div
          ref={pageStackRef}
          className={`${styles.pageStack} ${
            pageMotion.dragging ? styles.pageStackDragging : ''
          } ${pageMotion.phase === 'prepare' ? styles.pageStackPrepare : ''}`}
          style={{ transform: `translate3d(${pageMotion.offset}px, 0, 0)` }}
          onPointerDown={handlePageDown}
          onPointerMove={handlePageMove}
          onPointerUp={handlePageEnd}
          onPointerCancel={cancelPagePointer}
          onTransitionEnd={handlePageTransitionEnd}
        >
          <div className={styles.pageEdge} aria-hidden="true" />
          <div className={styles.page}>
          {filteredDates.length > 0 ? (
            <div className={styles.pageContent}>
              <h2 className={styles.date}>{formatDateLabel(currentDate)}</h2>
              <div className={styles.recordList}>
                {visibleRecords.map(({ record, originalIndex }) => (
                  <article
                    className={styles.recordCard}
                    style={{ '--record-color': record.color }}
                    key={`${currentDate}-${originalIndex}`}
                  >
                    <div className={styles.recordHeader}>
                      <div>
                        {record.startTime && <div className={styles.time}>{record.startTime}</div>}
                        <h3 className={styles.part}>{record.part || '記録'}</h3>
                      </div>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.editButton}
                          onClick={() => onEdit(record, originalIndex, currentDate)}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => onDelete(currentDate, originalIndex)}
                          aria-label={`${record.part || '記録'}を削除`}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                    <div
                      className={styles.note}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(record.note || '') }}
                    />
                    <NotebookImage imageId={record.imageId} onOpen={onOpenImage} />
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>{allDates.length === 0 ? 'まだ記録がありません' : 'この色の記録はありません'}</strong>
              <p>{allDates.length === 0 ? 'カレンダーから最初の記録を追加しましょう。' : '全色表示に戻して記録を確認できます。'}</p>
              {allDates.length > 0 && (
                <button type="button" onClick={() => setFilterColor(null)}>全色に戻す</button>
              )}
            </div>
          )}
          </div>
        </div>

        <button
          type="button"
          className={styles.filterButton}
          style={{ '--filter-color': filterColor || '#f5f2e8' }}
          onPointerDown={handleFilterDown}
          onPointerMove={handleFilterMove}
          onPointerUp={handleFilterEnd}
          onPointerCancel={clearFilterPointer}
          aria-label="記録を色で絞り込む。タップで全色表示"
        >
          {!filterColor && <span className={styles.allColorsMark} />}
        </button>
        {fanState.open && <div className={styles.fanOverlay} aria-hidden="true" />}
        {fanState.open && fanOptions.map((option) => (
          <span
            className={`${styles.fanColor} ${fanState.activeColor === option.color ? styles.fanColorActive : ''}`}
            style={{ '--fan-color': option.color, '--fan-x': `${option.x}px`, '--fan-y': `${option.y}px` }}
            key={option.id}
          />
        ))}
      </div>

      <footer className={styles.pageIndicator} aria-live="polite">
        {filteredDates.length > 0 ? `${pageIndex + 1} / ${filteredDates.length}` : `0 / ${allDates.length}`}
      </footer>
    </section>
  );
}

export default memo(RecordNotebook);
