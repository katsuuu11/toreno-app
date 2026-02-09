import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import styles from './App.module.css';

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

const STORAGE_KEY_RECORDS = 'treno_records_v1';
const STORAGE_KEY_EDITBUFFERS = 'treno_editBuffers_v1';
const STORAGE_KEY_SUGGESTIONS = 'treno_suggestions_v1';
const MAX_IMAGES_PER_RECORD = 3;
const MAX_IMAGE_DATA_LENGTH = 600 * 1024;
const SWIPE_OPEN_THRESHOLD = 30;
const SWIPE_ACTION_WIDTH = 88;
const SWIPE_TAP_SUPPRESS_THRESHOLD = 8;
const SWIPE_TAP_SUPPRESS_MS = 280;
const TAP_MOVE_THRESHOLD_PX = 8;
const DATE_DOUBLE_TAP_THRESHOLD_MS = 300;
const DATE_TAP_MOVE_THRESHOLD_PX = 10;
const SUGGESTION_LIMIT = 8;
const SUGGESTION_MAX_ENTRIES = 1000;
const SUGGESTION_MAX_LEN = 40;
const SUGGESTION_MIN_LEN = 2;

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

const normalizeSuggestionKey = (text) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[\p{P}\p{S}]+/gu, '');

const getLinesFromHtml = (html) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  const text = container.innerText || '';
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const isExcludedSuggestionText = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length < SUGGESTION_MIN_LEN) return true;
  if (trimmed.length > SUGGESTION_MAX_LEN) return true;
  const lowered = trimmed.toLowerCase();
  if (lowered.includes('data:image/')) return true;
  if (lowered.includes('http://') || lowered.includes('https://')) return true;
  return false;
};

const pruneSuggestions = (suggestions) => {
  const filtered = suggestions.filter(
    (item) =>
      item &&
      typeof item.text === 'string' &&
      !isExcludedSuggestionText(item.text)
  );
  const normalized = filtered
    .map((item) => ({
      ...item,
      normalized: normalizeSuggestionKey(item.text),
      count: Number(item.count) || 0,
      lastUsed: Number(item.lastUsed) || 0,
    }))
    .filter((item) => item.normalized);
  if (normalized.length <= SUGGESTION_MAX_ENTRIES) {
    return normalized;
  }
  const sorted = [...normalized].sort((a, b) => {
    if (a.lastUsed !== b.lastUsed) return a.lastUsed - b.lastUsed;
    if (a.count !== b.count) return a.count - b.count;
    return b.text.length - a.text.length;
  });
  return sorted.slice(sorted.length - SUGGESTION_MAX_ENTRIES);
};

const loadStoredSuggestions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUGGESTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneSuggestions(parsed);
  } catch (error) {
    console.warn('Failed to load suggestions from storage', error);
    return [];
  }
};

const saveStoredSuggestions = (suggestions) => {
  try {
    const payload = pruneSuggestions(suggestions).map(
      ({ text, count, lastUsed }) => ({
        text,
        count,
        lastUsed,
      })
    );
    localStorage.setItem(STORAGE_KEY_SUGGESTIONS, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to save suggestions to storage', error);
  }
};

const mergeSuggestionsWithRecords = (existing, records) => {
  const map = new Map(existing.map((item) => [item.text, { ...item }]));
  Object.entries(records).forEach(([, value]) => {
    (value?.records || []).forEach((record) => {
      const lines = getLinesFromHtml(record.note || '');
      lines.forEach((line) => {
        const normalized = normalizeSuggestionKey(line);
        if (!normalized || isExcludedSuggestionText(line)) return;
        const current = map.get(line);
        if (!current) {
          map.set(line, {
            text: line,
            count: 0,
            lastUsed: 0,
            normalized,
          });
        }
      });
    });
  });
  return pruneSuggestions(Array.from(map.values()));
};

const getTextBeforeCursor = (editor) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { textBefore: '', cursorIndex: 0, text: editor.innerText || '' };
  }
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(editor);
  preRange.setEnd(range.endContainer, range.endOffset);
  const textBefore = preRange.toString();
  const text = editor.innerText || '';
  return { textBefore, cursorIndex: textBefore.length, text };
};

const getCurrentPrefix = (editor) => {
  const { textBefore, cursorIndex, text } = getTextBeforeCursor(editor);
  const lineStart = textBefore.lastIndexOf('\n') + 1;
  const lineText = textBefore.slice(lineStart);
  const match = lineText.match(/(\S+)$/);
  const prefix = match ? match[1] : '';
  const prefixStart = match ? cursorIndex - prefix.length : cursorIndex;
  return { prefix, prefixStart, cursorIndex, text };
};

const setEditorPlainText = (editor, text) => {
  while (editor.firstChild) {
    editor.removeChild(editor.firstChild);
  }
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (line) {
      editor.appendChild(document.createTextNode(line));
    }
    if (index < lines.length - 1) {
      editor.appendChild(document.createElement('br'));
    }
  });
  if (lines.length === 0) {
    editor.appendChild(document.createElement('br'));
  }
};

const setCaretPositionByOffset = (editor, targetOffset) => {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let offset = targetOffset;
  const walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
  );
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent.length;
      if (offset <= length) {
        range.setStart(node, offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      offset -= length;
    } else if (node.nodeName === 'BR') {
      if (offset <= 1) {
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      offset -= 1;
    }
    node = walker.nextNode();
  }
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

const SuggestionBar = memo(function SuggestionBar({
  suggestions,
  onApply,
  onClose,
}) {
  return (
    <div className={styles.suggestionBar} role="presentation">
      <div className={styles.suggestionScroll} role="listbox">
        {suggestions.map((item) => (
          <button
            key={item.text}
            className={styles.suggestionChip}
            type="button"
            onClick={() => onApply(item.text)}
          >
            {item.text}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="候補バーを閉じる"
        className={styles.suggestionClose}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
});

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
}) {
  const sanitizedNote = useMemo(
    () => sanitizeHtml(record.note || ''),
    [record.note]
  );

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

          {record.images && record.images.length > 0 && (
            <div className={styles.recordImages}>
              {record.images.map((img, imgIndex) => (
                <img
                  key={imgIndex}
                  src={img}
                  alt={`記録画像 ${imgIndex + 1}`}
                  width="100"
                  height="100"
                  className={styles.recordImage}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const useSuggestionBar = ({
  editorRef,
  records,
  editingDate,
  composingRef,
  setNoteHtml,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const suggestionDataRef = useRef([]);
  const lastPrefixRef = useRef('');

  useEffect(() => {
    const stored = loadStoredSuggestions();
    const merged = mergeSuggestionsWithRecords(stored, records);
    suggestionDataRef.current = merged;
    saveStoredSuggestions(merged);
  }, [records]);

  const refreshSuggestions = useCallback(() => {
    if (composingRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;
    const { prefix } = getCurrentPrefix(editor);
    setCurrentPrefix(prefix);
    if (prefix !== lastPrefixRef.current) {
      setIsClosed(false);
      lastPrefixRef.current = prefix;
    }
    if (!prefix) {
      setSuggestions([]);
      return;
    }
    const normalizedPrefix = normalizeSuggestionKey(prefix);
    if (!normalizedPrefix) {
      setSuggestions([]);
      return;
    }
    const now = Date.now();
    const targetYmd = editingDate ? formatDateKey(editingDate) : null;
    const matches = suggestionDataRef.current
      .filter((item) => item.normalized.startsWith(normalizedPrefix))
      .map((item) => {
        const days =
          item.lastUsed > 0 ? (now - item.lastUsed) / 86400000 : 9999;
        const recencyWeight = item.lastUsed ? 1 / (1 + days) : 0;
        const frequencyWeight = Math.log10(item.count + 1);
        const sameDayBoost =
          targetYmd && item.lastUsed
            ? formatDateKey(new Date(item.lastUsed)) === targetYmd
              ? 0.5
              : 0
            : 0;
        return {
          ...item,
          score: recencyWeight * 2 + frequencyWeight + sameDayBoost,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, SUGGESTION_LIMIT);
    setSuggestions(matches);
  }, [composingRef, editorRef, editingDate]);

  const applySuggestion = useCallback(
    (text) => {
      const editor = editorRef.current;
      if (!editor) return;
      const { prefixStart, cursorIndex, text: fullText } =
        getCurrentPrefix(editor);
      const newText =
        fullText.slice(0, prefixStart) +
        text +
        fullText.slice(cursorIndex);
      setEditorPlainText(editor, newText);
      setCaretPositionByOffset(editor, prefixStart + text.length);
      setNoteHtml(sanitizeHtml(editor.innerHTML));
      const now = Date.now();
      const map = new Map(
        suggestionDataRef.current.map((item) => [item.text, { ...item }])
      );
      const current = map.get(text);
      if (current) {
        current.count += 1;
        current.lastUsed = now;
      } else if (!isExcludedSuggestionText(text)) {
        map.set(text, {
          text,
          count: 1,
          lastUsed: now,
          normalized: normalizeSuggestionKey(text),
        });
      }
      const updated = pruneSuggestions(Array.from(map.values()));
      suggestionDataRef.current = updated;
      saveStoredSuggestions(updated);
      refreshSuggestions();
    },
    [editorRef, refreshSuggestions, setNoteHtml]
  );

  const addSuggestionsFromNote = useCallback((noteHtml) => {
    const lines = getLinesFromHtml(noteHtml || '');
    if (lines.length === 0) return;
    const map = new Map(
      suggestionDataRef.current.map((item) => [item.text, { ...item }])
    );
    lines.forEach((line) => {
      const normalized = normalizeSuggestionKey(line);
      if (!normalized || isExcludedSuggestionText(line)) return;
      if (map.has(line)) return;
      map.set(line, {
        text: line,
        count: 0,
        lastUsed: 0,
        normalized,
      });
    });
    const updated = pruneSuggestions(Array.from(map.values()));
    suggestionDataRef.current = updated;
    saveStoredSuggestions(updated);
  }, []);

  const closeSuggestionBar = useCallback(() => {
    setIsClosed(true);
  }, []);

  return {
    currentPrefix,
    suggestions,
    isClosed,
    refreshSuggestions,
    applySuggestion,
    addSuggestionsFromNote,
    closeSuggestionBar,
  };
};

function App() {
  const [noteHtml, setNoteHtml] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingDate, setEditingDate] = useState(null);
  const [inputParts, setInputParts] = useState('');
  const [selectedColor, setSelectedColor] = useState('#e74c3c');
  const [records, setRecords] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
      const migrated = migrateRecords(raw ? JSON.parse(raw) : null);
      if (Object.keys(migrated).length > 0) {
        return migrated;
      }
      const legacyRaw = localStorage.getItem('records');
      const legacyMigrated = migrateRecords(
        legacyRaw ? JSON.parse(legacyRaw) : null
      );
      if (Object.keys(legacyMigrated).length > 0) {
        localStorage.setItem(
          STORAGE_KEY_RECORDS,
          JSON.stringify(legacyMigrated)
        );
        return legacyMigrated;
      }
      return {};
    } catch (error) {
      console.warn('Failed to load records from storage', error);
      return {};
    }
  });
  const [editBuffers, setEditBuffers] = useState(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY_EDITBUFFERS) ||
        localStorage.getItem('editBuffers');
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('Failed to load edit buffers from storage', error);
      return {};
    }
  });
  const [mode, setMode] = useState('calendar'); // 'calendar', 'form'
  const [editingIndex, setEditingIndex] = useState(null);
  const [images, setImages] = useState([]);
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [draggingSwipeId, setDraggingSwipeId] = useState(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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

  const {
    currentPrefix,
    suggestions,
    isClosed: isSuggestionClosed,
    refreshSuggestions,
    applySuggestion,
    addSuggestionsFromNote,
    closeSuggestionBar,
  } = useSuggestionBar({
    editorRef,
    records,
    editingDate,
    composingRef,
    setNoteHtml,
  });

  const showSuggestionBar =
    mode === 'form' &&
    currentPrefix.length > 0 &&
    suggestions.length > 0 &&
    !isSuggestionClosed;

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

  const executeDelete = (target) => {
    if (!target) return;
    const { ymd, index, swipeId } = target;

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
      setImages([]);
    }

    if (openSwipeId === swipeId) {
      closeSwipe();
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
    setImages([]);
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
  const handleEditRecord = (record, index) => {
    setEditingDate(selectedDate);
    setEditingIndex(index);
    setInputParts(record.part);
    setNoteHtml(record.note);
    setSelectedColor(record.color);
    setImages(record.images || []);
    setMode('form');
    closeSwipe();
  };

  // 画像アップロード処理
  const handleImageUpload = (event) => {
    const input = event.target;
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 画像をリサイズ（最大幅400px）
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            alert('画像の読み込みに失敗しました。');
            if (input) input.value = '';
            return;
          }

          const maxWidth = 400;
          const ratio = Math.min(
            1,
            Math.min(maxWidth / img.width, maxWidth / img.height)
          );

          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const resizedImageData = canvas.toDataURL('image/jpeg', 0.8);
          if (resizedImageData.length > MAX_IMAGE_DATA_LENGTH) {
            alert('画像サイズが大きすぎるため追加できません。');
            if (input) input.value = '';
            return;
          }
          setImages((prev) => {
            if (prev.length + 1 > MAX_IMAGES_PER_RECORD) {
              alert('画像は最大3枚まで添付できます。');
              return prev;
            }
            return [...prev, resizedImageData];
          });
          if (input) input.value = '';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else if (input) {
      input.value = '';
    }
  };

  // 画像削除
  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 保存処理
  const handleSave = () => {
    if (!editingDate) return;
    const ymd = formatDateKey(editingDate);
    const cleanHtml =
      sanitizeHtml(noteHtml || '').trim() || '<p><br></p>';
    const noteText = cleanHtml
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!inputParts.trim() && !noteText && images.length === 0) {
      alert('部位・記録・画像のいずれかを入力してください。');
      return;
    }

    const newRecord = {
      part: inputParts,
      color: selectedColor,
      note: cleanHtml,
      images,
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

    addSuggestionsFromNote(cleanHtml);

    setMode('calendar');
    setInputParts('');
    setNoteHtml('');
    setSelectedColor('#e74c3c');
    setEditingIndex(null);
    setImages([]);
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
      },
    }));
  }, [inputParts, noteHtml, selectedColor, editingDate]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    } catch (error) {
      console.warn('Failed to save records to storage', error);
      warnStorageError(
        '記録の保存に失敗しました。ブラウザの容量をご確認ください。'
      );
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EDITBUFFERS, JSON.stringify(editBuffers));
    } catch (error) {
      console.warn('Failed to save edit buffers to storage', error);
      warnStorageError(
        '編集中データの保存に失敗しました。ブラウザの容量をご確認ください。'
      );
    }
  }, [editBuffers]);

  useEffect(() => {
    if (mode !== 'form') return;
    const el = editorRef.current;
    if (!el) return;
    const clean = sanitizeHtml(noteHtml || '<p><br></p>');
    if (el.innerHTML !== clean) {
      el.innerHTML = clean;
    }
    refreshSuggestions();
  }, [mode, editingDate, editingIndex, noteHtml, refreshSuggestions]);

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

            <main
              className={styles.main}
              style={
                showSuggestionBar
                  ? { paddingBottom: '6.5rem' }
                  : undefined
              }
            >
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
                    refreshSuggestions();
                  }}
                  onInput={() => {
                    if (composingRef.current) return;
                    const html = editorRef.current?.innerHTML || '';
                    setNoteHtml(sanitizeHtml(html));
                    refreshSuggestions();
                  }}
                  onKeyUp={refreshSuggestions}
                  onClick={refreshSuggestions}
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

                {images.length > 0 && (
                  <div className={styles.imagePreview}>
                    {images.map((img, index) => (
                      <div key={index} className={styles.imagePreviewItem}>
                        <img
                          src={img}
                          alt={`プレビュー ${index + 1}`}
                          className={styles.previewImage}
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className={styles.removeImageButton}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </main>
            {showSuggestionBar && (
              <SuggestionBar
                suggestions={suggestions}
                onApply={applySuggestion}
                onClose={closeSuggestionBar}
              />
            )}
          </div>
        )}

        {/* フローティング追加ボタン（カレンダーモードでのみ表示） */}
        {mode === 'calendar' && (
          <button onClick={handleAddRecord} className={styles.fab} type="button">
            <IconPlus />
          </button>
        )}

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
