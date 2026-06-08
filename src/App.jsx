import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import styles from './App.module.css';
import {
  deleteImageBlob,
  initializeLocalDb,
  loadEditBuffers,
  loadImageBlob,
  loadRecords,
  migrateFromLocalStorageIfNeeded,
  migrateRecordImagesToBlobs,
  saveEditBuffers,
  saveImageBlob,
  saveRecords,
} from './services/localDb';

// 許可する最小限のタグと属性（必要に応じて増やせる）
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'span',
  'div',
  'img',
];
const ALLOWED_ATTR = ['style', 'src', 'alt'];

const sanitizeHtml = (html) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });

const insertHtmlAtCursor = (html) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const temp = document.createElement('div');
  temp.innerHTML = html;
  const fragment = document.createDocumentFragment();
  let node = temp.firstChild;
  while (node) {
    const next = node.nextSibling;
    fragment.appendChild(node);
    node = next;
  }

  const lastNode = fragment.lastChild;
  range.insertNode(fragment);

  if (lastNode) {
    const nextRange = document.createRange();
    nextRange.setStartAfter(lastNode);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }

  return true;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNowHHmm = () =>
  new Date().toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const SWIPE_OPEN_THRESHOLD = 30;
const SWIPE_ACTION_WIDTH = 88;
const SWIPE_TAP_SUPPRESS_THRESHOLD = 8;
const SWIPE_TAP_SUPPRESS_MS = 280;
const TAP_MOVE_THRESHOLD_PX = 8;
const DATE_DOUBLE_TAP_THRESHOLD_MS = 300;
const DATE_TAP_MOVE_THRESHOLD_PX = 10;

const COLOR_OPTIONS = [
  { id: 'red', color: '#e74c3c' },
  { id: 'green', color: '#2ecc71' },
  { id: 'yellow', color: '#f1c40f' },
  { id: 'purple', color: '#8e44ad' },
  { id: 'blue', color: '#1A2996' },
  { id: 'pink', color: '#ff66b3' },
  { id: 'black', color: '#000000' },
];

const migrateRecords = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return {};
  const migrated = {};
  Object.entries(parsed).forEach(([ymd, value]) => {
    if (Array.isArray(value)) {
      migrated[ymd] = { records: value };
    } else if (
      value &&
      typeof value === 'object' &&
      Array.isArray(value.records)
    ) {
      migrated[ymd] = { records: value.records };
    }
  });
  return migrated;
};

const IconSave = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17,21 17,13 7,13 7,21" />
    <polyline points="7,3 7,8 15,8" />
  </svg>
);

const IconArrowLeft = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12,19 5,12 12,5" />
  </svg>
);

const IconPlus = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconEdit = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconCamera = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const ImageLightboxModal = memo(function ImageLightboxModal({
  isOpen,
  images,
  initialIndex,
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    modalRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'ArrowRight' && images.length > 1) {
        event.preventDefault();
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }
      if (event.key === 'ArrowLeft' && images.length > 1) {
        event.preventDefault();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [images.length, isOpen, onClose]);

  if (!isOpen || images.length === 0) return null;

  const canNavigate = images.length > 1;

  return (
    <div
      className={styles.lightboxOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="画像の拡大表示"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      ref={modalRef}
      tabIndex={-1}
    >
      <button
        type="button"
        className={styles.lightboxCloseButton}
        onClick={onClose}
        aria-label="画像モーダルを閉じる"
      >
        ×
      </button>

      {canNavigate && (
        <button
          type="button"
          className={`${styles.lightboxNavButton} ${styles.lightboxNavPrev}`}
          onClick={() =>
            setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
          }
          aria-label="前の画像"
        >
          ‹
        </button>
      )}

      <img
        src={images[currentIndex]}
        alt={`拡大画像 ${currentIndex + 1}`}
        className={styles.lightboxImage}
      />

      {canNavigate && (
        <button
          type="button"
          className={`${styles.lightboxNavButton} ${styles.lightboxNavNext}`}
          onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
          aria-label="次の画像"
        >
          ›
        </button>
      )}

      {canNavigate && (
        <div className={styles.lightboxIndicator}>
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
});

const RecordCardItem = memo(function RecordCardItem({
  record,
  index,
  swipeId,
  selectedYmd,
  selectedDateLabel,
  isOpen,
  translateX,
  handleSwipePointerDown,
  handleSwipePointerMove,
  handleSwipePointerEnd,
  handleCardActivate,
  startDeleteConfirmation,
  handleEditRecord,
  openLightbox,
}) {
  const sanitizedNote = useMemo(
    () => sanitizeHtml(record.note || ''),
    [record.note]
  );
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let isActive = true;

    if (!record.imageId) {
      setImageUrl('');
      return undefined;
    }

    (async () => {
      try {
        const blob = await loadImageBlob(record.imageId);
        if (!isActive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (error) {
        console.warn('Failed to load image from IndexedDB', error);
      }
    })();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [record.imageId]);

  return (
    <div className={styles.swipeCardContainer} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={styles.swipeDeleteAction}
        onClick={(event) => {
          event.stopPropagation();
          startDeleteConfirmation({
            ymd: selectedYmd,
            index,
            swipeId,
            dateLabel: selectedDateLabel,
          });
        }}
      >
        削除
      </button>

      <div
        className={styles.recordCardSurface}
        style={{ transform: `translateX(${translateX}px)` }}
        onPointerDown={(event) => handleSwipePointerDown(event, swipeId)}
        onPointerMove={handleSwipePointerMove}
        onPointerUp={(event) =>
          handleCardActivate(event, {
            swipeId,
            isOpen,
            record,
            index,
          })
        }
        onPointerCancel={handleSwipePointerEnd}
      >
        <div className={styles.recordCard} style={{ borderLeft: `8px solid ${record.color}` }}>
          {record.startTime && (
            <div className={styles.recordMeta}>
              <span className={styles.recordTime}>{record.startTime}</span>
            </div>
          )}
          <div className={styles.recordHeader}>
            <p className={styles.recordPart}>{record.part}</p>
            <div className={styles.recordActions}>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleEditRecord(record, index);
                }}
                className={styles.iconButton}
                title="編集"
                type="button"
              >
                <IconEdit />
              </button>
            </div>
          </div>

          <div dangerouslySetInnerHTML={{ __html: sanitizedNote }} className={styles.recordNote} />

          {imageUrl && (
            <div className={styles.recordImages}>
              <button
                type="button"
                className={styles.recordImageButton}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerMove={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onPointerCancel={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  openLightbox([imageUrl], 0, event.currentTarget);
                }}
                aria-label="記録画像を拡大表示"
              >
                <img
                  src={imageUrl}
                  alt="記録画像"
                  width="100"
                  height="100"
                  className={styles.recordImage}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});


function App() {
  const [noteHtml, setNoteHtml] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingDate, setEditingDate] = useState(null);
  const [inputParts, setInputParts] = useState('');
  const [selectedColor, setSelectedColor] = useState('#e74c3c');
  const [startTime, setStartTime] = useState('');
  const [records, setRecords] = useState({});
  const [editBuffers, setEditBuffers] = useState({});
  const [isDbReady, setIsDbReady] = useState(false);
  const [mode, setMode] = useState('calendar'); // 'calendar', 'form'
  const [editingIndex, setEditingIndex] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [selectedImageBlob, setSelectedImageBlob] = useState(null);
  const [currentImageId, setCurrentImageId] = useState(null);
  const [isImageRemoved, setIsImageRemoved] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [draggingSwipeId, setDraggingSwipeId] = useState(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    initialIndex: 0,
  });

  const editorRef = useRef(null);
  const composingRef = useRef(false);
  const storageWarnedRef = useRef(0);
  const swipeGestureRef = useRef({
    id: null,
    pointerId: null,
    shouldCapturePointer: false,
    startX: 0,
    startY: 0,
    baseOffset: 0,
    isHorizontal: false,
    moved: false,
    exceededTapMove: false,
    latestDx: 0,
  });
  const tapSuppressRef = useRef({
    active: false,
    consumed: false,
    timerId: null,
  });
  const lastDateTapRef = useRef({
    ymd: null,
    timeStamp: 0,
  });
  const datePointerRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const suppressDateClickRef = useRef(false);
  const lastCardTapRef = useRef({
    swipeId: null,
    timeStamp: 0,
    x: null,
    y: null,
  });
  const lightboxTriggerRef = useRef(null);
  const formImageUrlRef = useRef('');

  const updateFormImagePreview = useCallback((url) => {
    if (formImageUrlRef.current && formImageUrlRef.current !== url) {
      URL.revokeObjectURL(formImageUrlRef.current);
    }
    formImageUrlRef.current = url;
    setImagePreviewUrl(url);
  }, []);

  const clearFormImageState = useCallback(() => {
    updateFormImagePreview('');
    setSelectedImageBlob(null);
    setCurrentImageId(null);
    setIsImageRemoved(false);
  }, [updateFormImagePreview]);

  useEffect(() => () => {
    if (formImageUrlRef.current) {
      URL.revokeObjectURL(formImageUrlRef.current);
    }
  }, []);

  const warnStorageError = (message) => {
    const now = Date.now();
    if (now - storageWarnedRef.current < 10000) return;
    storageWarnedRef.current = now;
    alert(message);
  };

  const closeSwipe = () => {
    setOpenSwipeId(null);
    setDraggingSwipeId(null);
    setDragOffsetX(0);
    tapSuppressRef.current.active = false;
    tapSuppressRef.current.consumed = false;
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const openLightbox = useCallback((targetImages, index, triggerElement) => {
    lightboxTriggerRef.current = triggerElement || null;
    setLightboxState({
      isOpen: true,
      images: Array.isArray(targetImages) ? targetImages : [],
      initialIndex: index,
    });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
    const trigger = lightboxTriggerRef.current;
    if (trigger && typeof trigger.focus === 'function') {
      requestAnimationFrame(() => {
        trigger.focus();
      });
    }
  }, []);

  const executeDelete = (target) => {
    if (!target) return;
    const { ymd, index, swipeId } = target;
    const imageIdToDelete = records[ymd]?.records?.[index]?.imageId;

    setRecords((prev) => {
      const updated = (prev[ymd]?.records || []).filter((_, i) => i !== index);
      if (updated.length === 0) {
        const copy = { ...prev };
        delete copy[ymd];
        return copy;
      }
      return { ...prev, [ymd]: { records: updated } };
    });

    setEditBuffers((prev) => {
      if (!prev[ymd]) return prev;
      const copy = { ...prev };
      delete copy[ymd];
      return copy;
    });

    if (editingDate && formatDateKey(editingDate) === ymd && editingIndex === index) {
      setMode('calendar');
      setEditingDate(null);
      setEditingIndex(null);
      setInputParts('');
      setNoteHtml('');
      setSelectedColor('#e74c3c');
      setStartTime('');
      clearFormImageState();
    }

    if (openSwipeId === swipeId) {
      closeSwipe();
    }

    if (imageIdToDelete) {
      deleteImageBlob(imageIdToDelete).catch((error) => {
        console.warn('Failed to delete image from IndexedDB', error);
      });
    }

    closeDeleteDialog();
  };

  const startDeleteConfirmation = (target) => {
    tapSuppressRef.current.active = false;
    tapSuppressRef.current.consumed = false;
    setDeleteTarget(target);
    setIsDeleteDialogOpen(true);
  };

  const scheduleTapSuppressReset = () => {
    if (tapSuppressRef.current.timerId) {
      clearTimeout(tapSuppressRef.current.timerId);
    }
    tapSuppressRef.current.timerId = setTimeout(() => {
      tapSuppressRef.current.active = false;
      tapSuppressRef.current.consumed = false;
      tapSuppressRef.current.timerId = null;
    }, SWIPE_TAP_SUPPRESS_MS);
  };

  const shouldConsumeSuppressedTap = () => {
    if (!tapSuppressRef.current.active || tapSuppressRef.current.consumed) {
      return false;
    }
    tapSuppressRef.current.consumed = true;
    return true;
  };

  const extractEventPoint = (event) => {
    if (event.changedTouches && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return {
      x: typeof event.clientX === 'number' ? event.clientX : null,
      y: typeof event.clientY === 'number' ? event.clientY : null,
    };
  };

  const isDuplicateCardTap = (event, swipeId) => {
    const { x, y } = extractEventPoint(event);
    const timeStamp = typeof event.timeStamp === 'number' ? event.timeStamp : Date.now();
    const lastTap = lastCardTapRef.current;
    const isSameSwipe = lastTap.swipeId === swipeId;
    const isNearTime = Math.abs(timeStamp - lastTap.timeStamp) <= 80;
    const isNearPoint =
      x !== null &&
      y !== null &&
      lastTap.x !== null &&
      lastTap.y !== null &&
      Math.abs(x - lastTap.x) <= 2 &&
      Math.abs(y - lastTap.y) <= 2;

    lastCardTapRef.current = { swipeId, timeStamp, x, y };

    return isSameSwipe && isNearTime && isNearPoint;
  };

  const handleSwipePointerDown = (event, swipeId) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (openSwipeId && openSwipeId !== swipeId) {
      setOpenSwipeId(null);
    }

    const shouldCapturePointer = event.pointerType === 'mouse';
    if (shouldCapturePointer) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const baseOffset = openSwipeId === swipeId ? -SWIPE_ACTION_WIDTH : 0;
    swipeGestureRef.current = {
      id: swipeId,
      pointerId: event.pointerId,
      shouldCapturePointer,
      startX: event.clientX,
      startY: event.clientY,
      baseOffset,
      isHorizontal: false,
      moved: false,
      exceededTapMove: false,
      latestDx: 0,
    };
    setDraggingSwipeId(swipeId);
    setDragOffsetX(baseOffset);
  };

  const handleSwipePointerMove = (event) => {
    const swipe = swipeGestureRef.current;
    if (!swipe.id || swipe.pointerId !== event.pointerId) return;

    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;

    if (!swipe.isHorizontal) {
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        swipe.isHorizontal = true;
      } else if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
        return;
      }
    }

    if (!swipe.isHorizontal) return;

    swipe.latestDx = dx;
    if (!swipe.exceededTapMove && Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) {
      swipe.exceededTapMove = true;
    }
    if (Math.abs(dx) > SWIPE_TAP_SUPPRESS_THRESHOLD) {
      swipe.moved = true;
    }
    let nextOffset = swipe.baseOffset + dx;
    if (nextOffset > 0) nextOffset = 0;
    if (nextOffset < -SWIPE_ACTION_WIDTH) nextOffset = -SWIPE_ACTION_WIDTH;
    setDragOffsetX(nextOffset);
  };

  const handleSwipePointerEnd = (event) => {
    const swipe = swipeGestureRef.current;
    if (!swipe.id || swipe.pointerId !== event.pointerId) return;

    if (swipe.shouldCapturePointer && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (swipe.moved) {
      tapSuppressRef.current.active = true;
      tapSuppressRef.current.consumed = false;
      scheduleTapSuppressReset();
      if (dragOffsetX <= -SWIPE_OPEN_THRESHOLD) {
        setOpenSwipeId(swipe.id);
      } else {
        setOpenSwipeId(null);
      }
    }

    swipeGestureRef.current = {
      id: null,
      pointerId: null,
      shouldCapturePointer: false,
      startX: 0,
      startY: 0,
      baseOffset: 0,
      isHorizontal: false,
      moved: false,
      exceededTapMove: false,
      latestDx: 0,
    };
    setDraggingSwipeId(null);
    setDragOffsetX(0);
  };

  const handleCardActivate = (event, { swipeId, isOpen, record, index }) => {
    const swipe = swipeGestureRef.current;
    const pointerDx = event.clientX - swipe.startX;
    const pointerDy = event.clientY - swipe.startY;
    const exceededTapMove =
      swipe.id === swipeId &&
      swipe.pointerId === event.pointerId &&
      (swipe.exceededTapMove || Math.hypot(pointerDx, pointerDy) > TAP_MOVE_THRESHOLD_PX);
    const wasSwipeMove =
      swipe.id === swipeId &&
      swipe.pointerId === event.pointerId &&
      swipe.moved;

    handleSwipePointerEnd(event);

    if (wasSwipeMove) return;
    if (exceededTapMove) return;
    if (isDuplicateCardTap(event, swipeId)) return;
    if (shouldConsumeSuppressedTap()) return;

    if (isOpen) {
      closeSwipe();
      return;
    }

    handleEditRecord(record, index);
  };

  // 日付クリック処理
  const handleDateClick = (date) => {
    setSelectedDate(date);
    closeSwipe();
  };

  const goToNewRecord = (date) => {
    setSelectedDate(date);
    setEditingDate(date);
    setEditingIndex(null);
    const ymd = formatDateKey(date);
    const buffer = editBuffers[ymd] || {};
    setInputParts(buffer.part || '');
    setNoteHtml(buffer.note || '');
    setSelectedColor(buffer.color || '#e74c3c');
    setStartTime(buffer.startTime || getNowHHmm());
    clearFormImageState();
    setMode('form');
  };

  // フローティングボタンから記録入力画面へ
  const handleAddRecord = () => {
    goToNewRecord(selectedDate);
  };

  const handleDatePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    datePointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handleDatePointerMove = (event) => {
    const pointer = datePointerRef.current;
    if (pointer.pointerId !== event.pointerId) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (!pointer.moved && Math.hypot(dx, dy) > DATE_TAP_MOVE_THRESHOLD_PX) {
      pointer.moved = true;
    }
  };

  const handleDatePointerEnd = (event, date) => {
    const pointer = datePointerRef.current;
    if (pointer.pointerId !== event.pointerId) return;

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    const exceededMove =
      pointer.moved || Math.hypot(dx, dy) > DATE_TAP_MOVE_THRESHOLD_PX;

    datePointerRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      moved: false,
    };

    if (exceededMove) return;

    const ymd = formatDateKey(date);
    const now = Date.now();
    const lastTap = lastDateTapRef.current;
    const isDoubleTap =
      lastTap.ymd === ymd && now - lastTap.timeStamp <= DATE_DOUBLE_TAP_THRESHOLD_MS;

    lastDateTapRef.current = { ymd, timeStamp: now };
    suppressDateClickRef.current = true;

    if (isDoubleTap) {
      goToNewRecord(date);
      return;
    }

    handleDateClick(date);
  };

  const handleDatePointerCancel = (event) => {
    const pointer = datePointerRef.current;
    if (pointer.pointerId !== event.pointerId) return;
    datePointerRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      moved: false,
    };
  };

  // 編集開始
  const handleEditRecord = async (record, index) => {
    setEditingDate(selectedDate);
    setEditingIndex(index);
    setInputParts(record.part);
    setNoteHtml(record.note);
    setSelectedColor(record.color);
    setStartTime(record.startTime || '');
    setSelectedImageBlob(null);
    setCurrentImageId(record.imageId || null);
    setIsImageRemoved(false);
    updateFormImagePreview('');

    if (record.imageId) {
      try {
        const blob = await loadImageBlob(record.imageId);
        if (blob) {
          updateFormImagePreview(URL.createObjectURL(blob));
        }
      } catch (error) {
        console.warn('Failed to load image for editing', error);
      }
    }

    setMode('form');
    closeSwipe();
  };

  // 画像アップロード処理
  const handleImageUpload = (event) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      input.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      input.value = '';
      return;
    }

    setSelectedImageBlob(file);
    setIsImageRemoved(false);
    updateFormImagePreview(URL.createObjectURL(file));
    input.value = '';
  };

  // 画像削除
  const removeImage = () => {
    updateFormImagePreview('');
    setSelectedImageBlob(null);
    setIsImageRemoved(Boolean(currentImageId));
  };

  // 保存処理
  const handleSave = async () => {
    if (!editingDate) return;
    const ymd = formatDateKey(editingDate);
    const bufferStartTime = editBuffers[ymd]?.startTime;
    const existingStartTime =
      editingIndex !== null ? records[ymd]?.records?.[editingIndex]?.startTime : null;
    const resolvedStartTime =
      bufferStartTime || existingStartTime || startTime || getNowHHmm();
    const cleanHtml =
      sanitizeHtml(noteHtml || '').trim() || '<p><br></p>';
    const noteText = cleanHtml
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!inputParts.trim() && !noteText && !imagePreviewUrl) {
      alert('部位・記録・画像のいずれかを入力してください。');
      return;
    }

    const previousImageId =
      editingIndex !== null ? records[ymd]?.records?.[editingIndex]?.imageId : null;
    let nextImageId = currentImageId;

    try {
      if (selectedImageBlob) {
        nextImageId = await saveImageBlob(selectedImageBlob);
      } else if (isImageRemoved) {
        nextImageId = null;
      }
    } catch (error) {
      console.warn('Failed to save image to IndexedDB', error);
      alert('画像の保存に失敗しました。');
      return;
    }

    const newRecord = {
      part: inputParts,
      color: selectedColor,
      note: cleanHtml,
      imageId: nextImageId || null,
      startTime: resolvedStartTime,
    };

    setRecords((prev) => {
      if (editingIndex !== null) {
        // 編集の場合
        const updated = (prev[ymd]?.records || []).map((record, index) =>
          index === editingIndex ? newRecord : record
        );
        return { ...prev, [ymd]: { records: updated } };
      }
      // 新規追加の場合
      return {
        ...prev,
        [ymd]: { records: [...(prev[ymd]?.records || []), newRecord] },
      };
    });

    setEditBuffers((prev) => {
      const copy = { ...prev };
      delete copy[ymd];
      return copy;
    });

    if (previousImageId && previousImageId !== nextImageId) {
      deleteImageBlob(previousImageId).catch((error) => {
        console.warn('Failed to delete replaced image from IndexedDB', error);
      });
    }

    setMode('calendar');
    setInputParts('');
    setNoteHtml('');
    setSelectedColor('#e74c3c');
    setEditingDate(null);
    setEditingIndex(null);
    setStartTime('');
    clearFormImageState();
  };

  // 編集バッファ更新
  useEffect(() => {
    if (!editingDate) return;
    const ymd = formatDateKey(editingDate);
    setEditBuffers((prev) => ({
      ...prev,
      [ymd]: {
        part: inputParts,
        note: noteHtml,
        color: selectedColor,
        startTime,
      },
    }));
  }, [inputParts, noteHtml, selectedColor, startTime, editingDate]);

  useEffect(() => {
    if (!isDbReady) return;
    (async () => {
      try {
        await saveRecords(records);
      } catch (error) {
        console.warn('Failed to save records to storage', error);
        warnStorageError(
          '記録の保存に失敗しました。ブラウザの容量をご確認ください。'
        );
      }
    })();
  }, [records, isDbReady]);

  useEffect(() => {
    if (!isDbReady) return;
    (async () => {
      try {
        await saveEditBuffers(editBuffers);
      } catch (error) {
        console.warn('Failed to save edit buffers to storage', error);
        warnStorageError(
          '編集中データの保存に失敗しました。ブラウザの容量をご確認ください。'
        );
      }
    })();
  }, [editBuffers, isDbReady]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await initializeLocalDb();
        await migrateFromLocalStorageIfNeeded({ migrateRecords });
        const [loadedRecords, loadedEditBuffers] = await Promise.all([
          loadRecords(),
          loadEditBuffers(),
        ]);
        const { records: imageMigratedRecords, changed } =
          await migrateRecordImagesToBlobs(loadedRecords);
        if (changed) {
          await saveRecords(imageMigratedRecords);
        }
        if (!isMounted) return;
        setRecords(imageMigratedRecords);
        setEditBuffers(loadedEditBuffers);
        setIsDbReady(true);
      } catch (error) {
        console.warn('Failed to initialize local DB', error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'form') return;
    const el = editorRef.current;
    if (!el) return;
    const clean = sanitizeHtml(noteHtml || '<p><br></p>');
    if (el.innerHTML !== clean) {
      el.innerHTML = clean;
    }
  }, [mode, editingDate, editingIndex, noteHtml]);

  useEffect(() => {
    if (!isDeleteDialogOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeDeleteDialog();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isDeleteDialogOpen]);

  useEffect(() => () => {
    if (tapSuppressRef.current.timerId) {
      clearTimeout(tapSuppressRef.current.timerId);
      tapSuppressRef.current.timerId = null;
    }
  }, []);

  // カスタムカレンダーコンポーネント
  const CustomCalendar = () => {
    const today = new Date();
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    const changeMonth = (delta) => {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setSelectedDate(newDate);
      closeSwipe();
    };

    return (
      <div className={styles.calendar}>
        {/* ナビゲーション */}
        <div className={styles.calendarNav}>
          <button onClick={() => changeMonth(-1)} className={styles.navButton} type="button">
            ‹
          </button>
          <div className={styles.calendarTitle}>
            {currentYear}年 {currentMonth + 1}月
          </div>
          <button onClick={() => changeMonth(1)} className={styles.navButton} type="button">
            ›
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className={styles.weekdays}>
          {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
            <div
              key={day}
              className={`${styles.weekday} ${
                index === 0 ? styles.sunday : index === 6 ? styles.saturday : ''
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className={styles.daysGrid}>
          {days.map((date, index) => {
            const ymd = formatDateKey(date);
            const isCurrentMonth = date.getMonth() === currentMonth;
            const isToday = today.toDateString() === date.toDateString();
            const isSelected =
              selectedDate.toDateString() === date.toDateString();
            const hasRecord = records[ymd]?.records?.length > 0;
            const dayOfWeek = date.getDay();

            const tileClasses = [
              styles.dayTile,
              !isCurrentMonth && styles.otherMonth,
              isCurrentMonth && dayOfWeek === 0 && styles.sunday,
              isCurrentMonth && dayOfWeek === 6 && styles.saturday,
              isToday && !isSelected && styles.today,
              isSelected && styles.selected,
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={index}
                onPointerDown={handleDatePointerDown}
                onPointerMove={handleDatePointerMove}
                onPointerUp={(event) => handleDatePointerEnd(event, date)}
                onPointerCancel={handleDatePointerCancel}
                onClick={() => {
                  if (suppressDateClickRef.current) {
                    suppressDateClickRef.current = false;
                    return;
                  }
                  handleDateClick(date);
                }}
                className={tileClasses}
                type="button"
              >
                {hasRecord ? (
                  <div
                    className={styles.recordBadge}
                    style={{ backgroundColor: records[ymd].records[0].color }}
                  >
                    {date.getDate()}
                  </div>
                ) : (
                  <span>{date.getDate()}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const selectedYmd = formatDateKey(selectedDate);
  const selectedRecords = records[selectedYmd]?.records || [];

  return (
    <div className={styles.appContainer}>
      <div className={styles.wrapper}>
        {/* ヘッダー */}
        {mode === 'calendar' && <h1 className={styles.appHeader}>TRENO</h1>}

        {/* メインコンテンツ */}
        {mode === 'calendar' && (
          <div
            onClick={() => {
              if (openSwipeId) closeSwipe();
            }}
          >
            <CustomCalendar />

            {/* 選択された日付の記録表示 */}
            {selectedRecords.length > 0 && (
              <div className={styles.recordsSection}>
                <h3 className={styles.recordsTitle}>
                  {selectedDate.toLocaleDateString('ja-JP', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}{' '}
                  の記録
                </h3>

                {/* 記録一覧 */}
                {selectedRecords.map((record, index) => {
                  const swipeId = `${selectedYmd}-${index}`;
                  const isDragging = draggingSwipeId === swipeId;
                  const isOpen = openSwipeId === swipeId;
                  const translateX = isDragging
                    ? dragOffsetX
                    : isOpen
                    ? -SWIPE_ACTION_WIDTH
                    : 0;

                  return (
                    <RecordCardItem
                      key={swipeId}
                      record={record}
                      index={index}
                      swipeId={swipeId}
                      selectedYmd={selectedYmd}
                      selectedDateLabel={selectedDate.toLocaleDateString('ja-JP')}
                      isOpen={isOpen}
                      translateX={translateX}
                      handleSwipePointerDown={handleSwipePointerDown}
                      handleSwipePointerMove={handleSwipePointerMove}
                      handleSwipePointerEnd={handleSwipePointerEnd}
                      handleCardActivate={handleCardActivate}
                      startDeleteConfirmation={startDeleteConfirmation}
                      handleEditRecord={handleEditRecord}
                      openLightbox={openLightbox}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === 'form' && editingDate && (
          <div className={styles.container}>
            <header className={styles.header}>
              <button
                className={styles.backButton}
                aria-label="カレンダーに戻る"
                onClick={() => setMode('calendar')}
                type="button"
              >
                <IconArrowLeft />
                <span>戻る</span>
              </button>

              <div className={styles.headerTime}>{startTime}</div>

              <div className={styles.headerActions}>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="image-upload"
                  className={styles.headerImageButton}
                  aria-label="画像を追加"
                >
                  <IconCamera />
                </label>

                <button
                  onClick={handleSave}
                  title="完了"
                  className={styles.headerSaveButton}
                  type="button"
                >
                  <IconSave />
                  完了
                </button>
              </div>
            </header>

            <main className={styles.main}>
              <div>
                <input
                  type="text"
                  value={inputParts}
                  onChange={(e) => setInputParts(e.target.value)}
                  placeholder="部位（胸／背中／脚 など自由入力）"
                  className={styles.bodyPartInput}
                />
              </div>

              <div className={styles.colorSection}>
                <p className={styles.colorLabel}>カレンダー表示色</p>
                <div className={styles.colorPalette}>
                  {COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedColor(option.color)}
                      className={`${styles.colorButton} ${
                        selectedColor === option.color
                          ? styles.colorButtonSelected
                          : ''
                      }`}
                      style={{
                        backgroundColor: option.color,
                        boxShadow:
                          selectedColor === option.color
                            ? `0 0 0 2px #fff, 0 0 0 4px ${option.color}`
                            : undefined,
                      }}
                      aria-label={`${option.id}色を選択`}
                      aria-pressed={selectedColor === option.color}
                      type="button"
                    />
                  ))}
                </div>
              </div>

              <div className={styles.notesWrapper}>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onCompositionStart={() => {
                    composingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    composingRef.current = false;
                    const html = editorRef.current?.innerHTML || '';
                    setNoteHtml(sanitizeHtml(html));
                  }}
                  onInput={() => {
                    if (composingRef.current) return;
                    const html = editorRef.current?.innerHTML || '';
                    setNoteHtml(sanitizeHtml(html));
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const html = e.clipboardData.getData('text/html');
                    const text = e.clipboardData.getData('text/plain');
                    const insert = sanitizeHtml(
                      html || (text || '').replace(/\n/g, '<br>')
                    );
                    const inserted = insertHtmlAtCursor(insert);
                    if (!inserted) {
                      document.execCommand('insertHTML', false, insert);
                    }
                  }}
                  className={styles.editor}
                />

                {imagePreviewUrl && (
                  <div className={styles.imagePreview}>
                    <div className={styles.imagePreviewItem}>
                      <button
                        type="button"
                        className={styles.previewImageButton}
                        onClick={(event) =>
                          openLightbox([imagePreviewUrl], 0, event.currentTarget)
                        }
                        aria-label="プレビューを拡大表示"
                      >
                        <img
                          src={imagePreviewUrl}
                          alt="プレビュー"
                          className={styles.previewImage}
                        />
                      </button>
                      <button
                        onClick={removeImage}
                        className={styles.removeImageButton}
                        type="button"
                        aria-label="画像を削除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </main>
          </div>
        )}

        {/* フローティング追加ボタン（カレンダーモードでのみ表示） */}
        {mode === 'calendar' && (
          <button onClick={handleAddRecord} className={styles.fab} type="button">
            <IconPlus />
          </button>
        )}

        <ImageLightboxModal
          isOpen={lightboxState.isOpen}
          images={lightboxState.images}
          initialIndex={lightboxState.initialIndex}
          onClose={closeLightbox}
        />

        {isDeleteDialogOpen && deleteTarget && (
          <div
            className={styles.dialogOverlay}
            role="presentation"
            onClick={closeDeleteDialog}
          >
            <div
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="delete-dialog-title" className={styles.dialogTitle}>
                記録を削除しますか？
              </h2>
              <p className={styles.dialogBody}>
                {deleteTarget.dateLabel} の記録を削除します。この操作は取り消せません。
              </p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.dialogCancelButton}
                  onClick={closeDeleteDialog}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className={styles.dialogDeleteButton}
                  onClick={() => executeDelete(deleteTarget)}
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
