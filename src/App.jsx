import { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';

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

// --- エディタ用アイコン ---
const IconBold = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z" />
  </svg>
);

const IconItalic = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="19" y1="4" x2="10" y2="4" />
    <line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);

const IconList = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="10" y1="6" x2="21" y2="6" />
    <line x1="10" y1="12" x2="21" y2="12" />
    <line x1="10" y1="18" x2="21" y2="18" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </svg>
);

const IconNumberList = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="10" y1="6" x2="21" y2="6" />
    <line x1="10" y1="12" x2="21" y2="12" />
    <line x1="10" y1="18" x2="21" y2="18" />
    <path d="M4 5h1v2H4zM4 11h2l-2 2v1h2" />
    <path d="M4 17h2v4H4z" />
  </svg>
);

const IconStrike = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <path d="M6 6a4 4 0 0 1 8 0v0.5M10 18a4 4 0 0 0 8 0v-0.5" />
  </svg>
);

// シンプルなSVGアイコンコンポーネント
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
  const [showColorOptions, setShowColorOptions] = useState(false);
  const [records, setRecords] = useState({});
  const [editBuffers, setEditBuffers] = useState({});
  const [mode, setMode] = useState('calendar'); // 'calendar', 'form'
  const [editingIndex, setEditingIndex] = useState(null);
  const [images, setImages] = useState([]);

  const editorRef = useRef(null);
  const composingRef = useRef(false);

  // ツールバー用（フォーカス保持して exec）
  const exec = (cmd) => (e) => {
    e.preventDefault();
    editorRef.current?.focus();
    document.execCommand(cmd);
  };

  // 日付クリック処理
  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  // フローティングボタンから記録入力画面へ
  const handleAddRecord = () => {
    setEditingDate(selectedDate);
    setEditingIndex(null);
    const ymd = selectedDate.toISOString().split('T')[0];
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
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 画像をリサイズ（最大幅400px）
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const maxWidth = 400;
          const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);

          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const resizedImageData = canvas.toDataURL('image/jpeg', 0.8);
          setImages((prev) => [...prev, resizedImageData]);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // 画像削除
  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 保存処理
  const handleSave = () => {
    if (!editingDate) return; // 念のためガード
    const ymd = editingDate.toISOString().split('T')[0];
    const cleanHtml = sanitizeHtml(noteHtml || '').trim() || '<p><br></p>';

    const newRecord = {
      part: inputParts,
      color: selectedColor,
      note: cleanHtml,
      images: images,
    };

    setRecords((prev) => {
      if (editingIndex !== null) {
        // 編集の場合
        const updated = [...(prev[ymd] || [])];
        updated[editingIndex] = newRecord;
        return { ...prev, [ymd]: updated };
      } else {
        // 新規追加の場合
        return {
          ...prev,
          [ymd]: [...(prev[ymd] || []), newRecord],
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
    setShowColorOptions(false);
    setEditingIndex(null);
    setImages([]);
  };

  // 削除処理
  const handleDelete = (ymd, index) => {
    setRecords((prev) => {
      const updated = [...prev[ymd]];
      updated.splice(index, 1);
      if (updated.length === 0) {
        const copy = { ...prev };
        delete copy[ymd];
        return copy;
      }
      return { ...prev, [ymd]: updated };
    });
  };

  // 編集バッファ更新
  useEffect(() => {
    if (!editingDate) return;
    const ymd = editingDate.toISOString().split('T')[0];
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
    if (mode !== 'form') return;
    const el = editorRef.current;
    if (!el) return;
    // 初期描画時だけDOMへ入れる（入力中にDOMを差し替えない）
    const clean = sanitizeHtml(noteHtml || '<p><br></p>');
    if (el.innerHTML !== clean) {
      el.innerHTML = clean;
    }
    // キャレット維持のため focus は任意
    // el.focus();
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
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto 2rem',
          background: '#fff',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          fontSize: '1rem',
          border: 'none',
          boxSizing: 'border-box',
        }}
      >
        {/* ナビゲーション */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            color: '#333',
          }}
        >
          <button
            onClick={() => changeMonth(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: '#333',
              fontSize: '1rem',
              fontWeight: 'bold',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.target.style.color = '#1e90ff')}
            onMouseLeave={(e) => (e.target.style.color = '#333')}
          >
            ‹
          </button>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 'bold',
            }}
          >
            {currentYear}年 {currentMonth + 1}月
          </div>
          <button
            onClick={() => changeMonth(1)}
            style={{
              background: 'none',
              border: 'none',
              color: '#333',
              fontSize: '1rem',
              fontWeight: 'bold',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.target.style.color = '#1e90ff')}
            onMouseLeave={(e) => (e.target.style.color = '#333')}
          >
            ›
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            marginBottom: '0.5rem',
          }}
        >
          {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                padding: '0.5rem 0',
                color: index === 0 ? 'red' : index === 6 ? '#3b82f6' : '#333',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
          }}
        >
          {days.map((date, index) => {
            const ymd = date.toISOString().split('T')[0];
            const isCurrentMonth = date.getMonth() === currentMonth;
            const isToday = today.toDateString() === date.toDateString();
            const isSelected =
              selectedDate.toDateString() === date.toDateString();
            const hasRecord = records[ymd]?.length > 0;
            const dayOfWeek = date.getDay();

            let textColor = isCurrentMonth ? '#333' : '#bbb';
            if (isCurrentMonth) {
              if (dayOfWeek === 0) textColor = '#e53935';
              if (dayOfWeek === 6) textColor = '#1e88e5';
            }

            const tileStyle = {
              aspectRatio: '1 / 1',
              padding: '2px 0',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s ease, transform 0.2s ease',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: textColor,
              fontSize: '1rem',
            };

            if (isToday && !isSelected) {
              tileStyle.background = '#f0f0f0';
              tileStyle.fontWeight = 'bold';
            }

            if (isSelected) {
              tileStyle.backgroundColor = '#1e90ff';
              tileStyle.color = '#fff';
              tileStyle.fontWeight = 'bold';
            }

            return (
              <button
                key={index}
                onClick={() => handleDateClick(date)}
                style={tileStyle}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.target.style.background = '#e0f0ff';
                    e.target.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.target.style.background = isToday
                      ? '#f0f0f0'
                      : 'transparent';
                    e.target.style.transform = 'scale(1)';
                  }
                }}
              >
                {hasRecord ? (
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      backgroundColor: records[ymd][0].color,
                      transition: 'transform 0.2s ease',
                    }}
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
    <div
      style={{
        fontFamily: "'Noto Sans JP', sans-serif",
        backgroundColor: '#f7f7f9',
        color: '#333',
        lineHeight: 1.6,
        minHeight: '100vh',
      }}
    >
      <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'left' }}>
        {/* ヘッダー */}
        <h1
          style={{
            fontSize: '2rem',
            textAlign: 'center',
            marginBottom: '1rem',
            padding: '1rem 0',
          }}
        >
          TRENO
        </h1>

        {/* メインコンテンツ */}
        {mode === 'calendar' && (
          <div>
            <CustomCalendar />

            {/* 選択された日付の記録表示 */}
            {records[selectedDate.toISOString().split('T')[0]]?.length > 0 && (
              <div
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  margin: '0 1rem 2rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.25rem',
                    marginBottom: '1rem',
                    fontWeight: 'bold',
                  }}
                >
                  {selectedDate.toLocaleDateString('ja-JP', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}{' '}
                  の記録
                </h3>

                {/* 記録一覧 */}
                {records[selectedDate.toISOString().split('T')[0]].map(
                  (record, index) => (
                    <div
                      key={index}
                      style={{
                        border: '1px solid #ccc',
                        padding: '1rem',
                        marginBottom: '1rem',
                        borderLeft: `8px solid ${record.color}`,
                        background: '#fff',
                        borderRadius: '8px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 'bold' }}>
                          {record.part}
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleEditRecord(record, index)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              color: '#666',
                            }}
                            className="icon-button"
                            title="編集"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(
                                selectedDate.toISOString().split('T')[0],
                                index
                              )
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              color: '#e53935',
                            }}
                            className="icon-button"
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
                        style={{
                          fontSize: '0.9rem',
                          lineHeight: 1.6,
                          marginBottom: '0.5rem',
                          color: '#666',
                          overflowWrap: 'anywhere',
                        }}
                      />
                      {/* 画像表示 */}
                      {record.images && record.images.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            marginTop: '0.5rem',
                          }}
                        >
                          {record.images.map((img, imgIndex) => (
                            <img
                              key={imgIndex}
                              src={img}
                              alt={`記録画像 ${imgIndex + 1}`}
                              style={{
                                maxWidth: '100px',
                                maxHeight: '100px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                              }}
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
          <div className="record-form-wrapper" style={{ padding: '0 1rem' }}>
            {/* ヘッダー */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <button
                onClick={() => setMode('calendar')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '50%',
                }}
                className="icon-button"
              >
                <IconArrowLeft />
              </button>
              <h2
                style={{
                  fontSize: '1.25rem',
                  margin: 0,
                  fontWeight: 'bold',
                  textAlign: 'left',
                }}
              >
                {editingDate.toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </h2>
            </div>

            {/* 部位入力 */}
            <label className="label">
              <strong>部位</strong>
              <br />
              <input
                type="text"
                value={inputParts}
                onChange={(e) => setInputParts(e.target.value)}
                placeholder="例：胸・肩"
                style={{
                  width: '50%',
                  fontSize: '1rem',
                  padding: '0.5rem',
                  color: '#333',
                  backgroundColor: '#fff',
                }}
              />
            </label>

            {/* カラー選択 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                margin: '1rem 0',
              }}
            >
              <div
                onClick={() => setShowColorOptions(!showColorOptions)}
                style={{
                  width: '28px',
                  height: '28px',
                  aspectRatio: '1',
                  backgroundColor: selectedColor,
                  borderRadius: '50%',
                  border: '2px solid #000',
                  cursor: 'pointer',
                }}
              ></div>

              <div
                className={`color-options ${
                  showColorOptions ? 'show' : 'hide'
                }`}
                style={{
                  marginLeft: '1rem',
                  display: 'flex',
                  gap: '8px',
                  opacity: showColorOptions ? 1 : 0,
                  transform: showColorOptions
                    ? 'translateY(0)'
                    : 'translateY(-10px)',
                  pointerEvents: showColorOptions ? 'auto' : 'none',
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                }}
              >
                {[
                  '#e74c3c', // 赤（そのまま）
                  '#2ecc71', // 緑（そのまま）
                  '#f1c40f', // 黄（そのまま）
                  '#8e44ad', // 紫（そのまま）
                  '#1A2996', // 濃ネイビー（コイネイビー）
                  '#ff66b3', // 明るめピンク
                  '#000000',
                ]
                  .filter((color) => color !== selectedColor)
                  .map((color) => (
                    <div
                      key={color}
                      className="color-option"
                      onClick={() => {
                        setSelectedColor(color);
                        setShowColorOptions(false);
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        backgroundColor: color,
                        border: '1px solid #ccc',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  ))}
              </div>
            </div>

            {/* 記録入力 */}
            <div className="record-label">
              <div className="record-label__header">
                <strong>記録</strong>
              </div>

              {/* ツールバー（onMouseDownでフォーカス維持） */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button type="button" onMouseDown={exec('bold')} title="太字">
                  <IconBold />
                </button>
                <button type="button" onMouseDown={exec('italic')} title="斜体">
                  <IconItalic />
                </button>
                <button
                  type="button"
                  onMouseDown={exec('insertUnorderedList')}
                  title="箇条書き"
                >
                  <IconList />
                </button>
                <button
                  type="button"
                  onMouseDown={exec('insertOrderedList')}
                  title="番号リスト"
                >
                  <IconNumberList />
                </button>
                <button
                  type="button"
                  onMouseDown={exec('strikeThrough')}
                  title="取り消し線"
                >
                  <IconStrike />
                </button>
              </div>

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onCompositionStart={() => {
                  composingRef.current = true;
                }}
                onCompositionEnd={() => {
                  composingRef.current = false;
                  // 確定時にだけ state 更新（→ 再描画の回数を最小化）
                  const html = editorRef.current?.innerHTML || '';
                  setNoteHtml(sanitizeHtml(html));
                }}
                onInput={() => {
                  if (composingRef.current) return; // 変換中は state 更新しない
                  const html = editorRef.current?.innerHTML || '';
                  setNoteHtml(sanitizeHtml(html));
                }}
                onPaste={(e) => {
                  // ペーストは手動サニタイズ + insertHTML
                  e.preventDefault();
                  const html = e.clipboardData.getData('text/html');
                  const text = e.clipboardData.getData('text/plain');
                  const insert = sanitizeHtml(
                    html || (text || '').replace(/\n/g, '<br>')
                  );
                  document.execCommand('insertHTML', false, insert);
                }}
                style={{
                  width: '80%',
                  padding: '1rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  minHeight: '200px',
                  outline: 'none',
                  lineHeight: 1.6,
                  color: '#333',
                  backgroundColor: '#fff',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              />

              {/* 画像プレビュー */}
              {images.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  {images.map((img, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <img
                        src={img}
                        alt={`プレビュー ${index + 1}`}
                        style={{
                          maxWidth: '100px',
                          maxHeight: '100px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                        }}
                      />
                      <button
                        onClick={() => removeImage(index)}
                        style={{
                          position: 'absolute',
                          top: '-5px',
                          right: '-5px',
                          background: '#e53935',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                position: 'sticky',
                bottom: 0,
                padding: '0.5rem',
                margin: '0 -1rem',
                display: 'flex',
                gap: '2rem',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 100,
              }}
            >
              <div>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="image-upload"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    color: '#555',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                  }}
                >
                  <IconCamera />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleSave}
                  title="保存"
                  style={{
                    backgroundColor: '#1e90ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <IconSave />
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* フローティング追加ボタン（カレンダーモードでのみ表示） */}
        {mode === 'calendar' && (
          <button
            onClick={handleAddRecord}
            style={{
              position: 'fixed',
              bottom: '1.5rem',
              right: '1.5rem',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#1e90ff',
              color: 'white',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              zIndex: 1000,
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#0066cc';
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#1e90ff';
              e.target.style.transform = 'scale(1)';
            }}
          >
            <IconPlus />
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
