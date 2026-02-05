import { useEffect, useState, useRef } from 'react';
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

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const STORAGE_KEY_RECORDS = 'treno_records_v1';
const STORAGE_KEY_EDITBUFFERS = 'treno_editBuffers_v1';
const MAX_IMAGES_PER_RECORD = 3;
const MAX_IMAGE_DATA_LENGTH = 600 * 1024;
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

const IconTrash = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
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

  const editorRef = useRef(null);
  const composingRef = useRef(false);
  const storageWarnedRef = useRef(0);

  const warnStorageError = (message) => {
    const now = Date.now();
    if (now - storageWarnedRef.current < 10000) return;
    storageWarnedRef.current = now;
    alert(message);
  };

  // 日付クリック処理
  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  // フローティングボタンから記録入力画面へ
  const handleAddRecord = () => {
    setEditingDate(selectedDate);
    setEditingIndex(null);
    const ymd = formatDateKey(selectedDate);
    const buffer = editBuffers[ymd] || {};
    setInputParts(buffer.part || '');
    setNoteHtml(buffer.note || '');
    setSelectedColor(buffer.color || '#e74c3c');
    setImages([]);
    setMode('form');
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
          const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);

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
    const cleanHtml = sanitizeHtml(noteHtml || '').trim() || '<p><br></p>';
    const noteText = cleanHtml.replace(/<br\s*\/?>/gi, '').replace(/<[^>]*>/g, '').trim();

    if (!inputParts.trim() && !noteText && images.length === 0) {
      alert('部位・記録・画像のいずれかを入力してください。');
      return;
    }

    const newRecord = {
      part: inputParts,
      color: selectedColor,
      note: cleanHtml,
      images: images,
    };

    setRecords((prev) => {
      if (editingIndex !== null) {
        // 編集の場合
        const updated = (prev[ymd]?.records || []).map((record, index) =>
          index === editingIndex ? newRecord : record
        );
        return { ...prev, [ymd]: { records: updated } };
      } else {
        // 新規追加の場合
        return {
          ...prev,
          [ymd]: { records: [...(prev[ymd]?.records || []), newRecord] },
        };
      }
    });

    setEditBuffers((prev) => {
      const copy = { ...prev };
      delete copy[ymd];
      return copy;
    });

    setMode('calendar');
    setInputParts('');
    setNoteHtml('');
    setSelectedColor('#e74c3c');
    setEditingIndex(null);
    setImages([]);
  };

  // 削除処理
  const handleDelete = (ymd, index) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    setRecords((prev) => {
      const updated = (prev[ymd]?.records || []).filter((_, i) => i !== index);
      if (updated.length === 0) {
        const copy = { ...prev };
        delete copy[ymd];
        return copy;
      }
      return { ...prev, [ymd]: { records: updated } };
    });
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
      localStorage.setItem(
        STORAGE_KEY_EDITBUFFERS,
        JSON.stringify(editBuffers)
      );
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
  }, [mode, editingDate, editingIndex]);

  // カスタムカレンダーコンポーネント
  const CustomCalendar = () => {
    const today = new Date();
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    const changeMonth = (delta) => {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setSelectedDate(newDate);
    };

    return (
      <div className={styles.calendar}>
        {/* ナビゲーション */}
        <div className={styles.calendarNav}>
          <button onClick={() => changeMonth(-1)} className={styles.navButton}>
            ‹
          </button>
          <div className={styles.calendarTitle}>
            {currentYear}年 {currentMonth + 1}月
          </div>
          <button onClick={() => changeMonth(1)} className={styles.navButton}>
            ›
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className={styles.weekdays}>
          {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
            <div
              key={day}
              className={`${styles.weekday} ${
                index === 0
                  ? styles.sunday
                  : index === 6
                  ? styles.saturday
                  : ''
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
                onClick={() => handleDateClick(date)}
                className={tileClasses}
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

  return (
    <div className={styles.appContainer}>
      <div className={styles.wrapper}>
        {/* ヘッダー */}
        <h1 className={styles.appHeader}>TRENO</h1>

        {/* メインコンテンツ */}
        {mode === 'calendar' && (
          <div>
            <CustomCalendar />

            {/* 選択された日付の記録表示 */}
            {records[formatDateKey(selectedDate)]?.records
              ?.length > 0 && (
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
                {records[formatDateKey(selectedDate)].records.map(
                  (record, index) => (
                    <div
                      key={index}
                      className={styles.recordCard}
                      style={{ borderLeft: `8px solid ${record.color}` }}
                      onClick={() => handleEditRecord(record, index)}
                    >
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
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(formatDateKey(selectedDate), index);
                            }}
                            className={`${styles.iconButton} ${styles.danger}`}
                            title="削除"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>

                      <div
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(record.note || ''),
                        }}
                        className={styles.recordNote}
                      />

                      {/* 画像表示 */}
                      {record.images && record.images.length > 0 && (
                        <div className={styles.recordImages}>
                          {record.images.map((img, imgIndex) => (
                            <img
                              key={imgIndex}
                              src={img}
                              alt={`記録画像 ${imgIndex + 1}`}
                              className={styles.recordImage}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
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
                    document.execCommand('insertHTML', false, insert);
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
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.actionBar}>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="image-upload"
                  className={styles.imageButton}
                  aria-label="画像を追加"
                >
                  <IconCamera />
                </label>

                <button
                  onClick={handleSave}
                  title="保存"
                  className={styles.saveButton}
                  type="button"
                >
                  <IconSave />
                  保存
                </button>
              </div>
            </main>
          </div>
        )}

        {/* フローティング追加ボタン（カレンダーモードでのみ表示） */}
        {mode === 'calendar' && (
          <button onClick={handleAddRecord} className={styles.fab}>
            <IconPlus />
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
