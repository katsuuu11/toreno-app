'use client';

import { ArrowLeft, ImagePlus } from 'lucide-react';
import styles from './WorkoutInput.module.css';

const COLORS = [
  { id: 'red', color: '#EF4444' },
  { id: 'orange', color: '#F97316' },
  { id: 'yellow', color: '#EAB308' },
  { id: 'green', color: '#22C55E' },
  { id: 'blue', color: '#3B82F6' },
  { id: 'purple', color: '#A855F7' },
  { id: 'gray', color: '#6B7280' },
];

export default function WorkoutInput({
  bodyPart = '',
  selectedColor = 'blue',
  notes = '',
  onChangeBodyPart = () => {},
  onChangeSelectedColor = () => {},
  onChangeNotes = () => {},
  onBack = () => {},
  onAddImage = () => {},
  onSave = () => {},
}) {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button
          className={styles.backButton}
          aria-label="カレンダーに戻る"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft size={20} />
          <span>戻る</span>
        </button>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Body Part Input */}
        <div>
          <input
            type="text"
            value={bodyPart}
            onChange={(e) => onChangeBodyPart(e.target.value)}
            placeholder="部位（胸／背中／脚 など自由入力）"
            className={styles.bodyPartInput}
          />
        </div>

        {/* Color Selection */}
        <div className={styles.colorSection}>
          <p className={styles.colorLabel}>カレンダー表示色</p>
          <div className={styles.colorPalette}>
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => onChangeSelectedColor(c.id)}
                className={`${styles.colorButton} ${
                  selectedColor === c.id ? styles.colorButtonSelected : ''
                }`}
                style={{
                  backgroundColor: c.color,
                  boxShadow:
                    selectedColor === c.id
                      ? `0 0 0 2px #fff, 0 0 0 4px ${c.color}`
                      : undefined,
                }}
                aria-label={`${c.id}色を選択`}
                aria-pressed={selectedColor === c.id}
                type="button"
              />
            ))}
          </div>
        </div>

        {/* Main Notes Textarea */}
        <div className={styles.notesWrapper}>
          <textarea
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            placeholder={`ベンチプレス 80kg 8×3
インクラインダンベル 24kg 10×3
ケーブルフライ 15kg 12×3

今日は調子良かった`}
            className={styles.notesTextarea}
          />
        </div>

        {/* Action Buttons */}
        <div className={styles.actionBar}>
          <button
            className={styles.imageButton}
            aria-label="画像を追加"
            onClick={onAddImage}
            type="button"
          >
            <ImagePlus size={20} />
          </button>

          <button className={styles.saveButton} onClick={onSave} type="button">
            保存
          </button>
        </div>
      </main>
    </div>
  );
}
