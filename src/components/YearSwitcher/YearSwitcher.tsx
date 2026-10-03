import { useRef } from 'react';
import type { MouseEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useGardenStore } from '../../store/gardenStore';
import type { IsoDate } from '../../types/garden';
import { shiftIsoDate, todayIso } from '../../utils/markers';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

// Wayback machine: переключение года + точной даты просмотра схемы.
// Единый момент времени: дата просмотра всегда реальная (по умолчанию —
// сегодня). Отдельного «годового режима» больше нет — стрелки у поля года
// сдвигают дату на ±1 год, сохраняя день и месяц; стрелки у поля даты — на ±1 день.
export default function YearSwitcher() {
  const currentYear = useGardenStore((s) => s.currentYear);
  const viewDate = useGardenStore((s) => s.viewDate);
  const setYear = useGardenStore((s) => s.setYear);
  const setViewDate = useGardenStore((s) => s.setViewDate);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  // Дата, на которую реально смотрим: выбранная или «сегодня».
  const effectiveDate = viewDate ?? todayIso();

  const btnClass =
    'w-8 h-8 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const onDateChange = (value: string): void => {
    if (!value) return; // пустое поле не откатываем в «неопределённый» режим
    setViewDate(value as IsoDate);
  };

  // Сдвиг точной даты просмотра на ±1 день (wayback machine).
  const stepDay = (days: number): void => {
    setViewDate(shiftIsoDate(effectiveDate, days));
  };

  // Сдвиг даты просмотра на ±1 год, сохраняя день и месяц
  // (29 февраля невисокосного года переносится на 28 февраля).
  const stepYear = (years: number): void => {
    const [y, m, d] = effectiveDate.split('-').map(Number);
    const targetYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, (y ?? CURRENT_NOW_YEAR()) + years));
    const day = d ?? 1;
    const lastDay = new Date(Date.UTC(targetYear, m ?? 1, 0)).getUTCDate();
    const safeDay = Math.min(day, lastDay);
    const iso = `${targetYear}-${String(m ?? 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}` as IsoDate;
    setViewDate(iso);
  };

  // Клик по текстовой части поля не всегда открывает календарь —
  // форсируем показ нативного date-picker'а.
  const openCalendar = (event: MouseEvent<HTMLElement>): void => {
    event.preventDefault();
    const el = dateInputRef.current;
    if (!el) return;
    el.focus();
    const picker = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof picker.showPicker === 'function') {
      try {
        picker.showPicker();
      } catch {
        /* браузер запретил показ вне user gesture — просто фокус */
      }
    }
  };

  return (
    <div className="absolute top-3 right-4 z-20 flex items-center gap-2 panel rounded-lg px-2 py-1 border border-border">
      {/* Точная дата просмотра («wayback») — всегда задана */}
      <button
        type="button"
        title="Предыдущий день"
        aria-label="Предыдущий день"
        className={btnClass}
        onClick={() => stepDay(-1)}
      >
        <ChevronLeft size={14} />
      </button>
      <div className="relative" onClick={openCalendar}>
        <input
          ref={dateInputRef}
          type="date"
          aria-label="Дата просмотра"
          title="Смотреть сад на конкретную дату (клик — открыть календарь)"
          value={effectiveDate}
          min={`${MIN_YEAR}-01-01`}
          max={`${MAX_YEAR}-12-31`}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-8 w-[8.75rem] cursor-pointer rounded-md border border-border bg-white px-1 text-xs text-text-primary outline-none focus:border-primary"
        />
      </div>
      <button
        type="button"
        title="Следующий день"
        aria-label="Следующий день"
        className={btnClass}
        onClick={() => stepDay(1)}
      >
        <ChevronRight size={14} />
      </button>
      <div className="w-px h-6 bg-border" />
      <button
        type="button"
        title="Предыдущий год (тот же день и месяц)"
        aria-label="Предыдущий год"
        className={btnClass}
        disabled={currentYear <= MIN_YEAR}
        onClick={() => stepYear(-1)}
      >
        <ChevronLeft size={16} />
      </button>
      <input
        type="number"
        value={currentYear}
        min={MIN_YEAR}
        max={MAX_YEAR}
        aria-label="Текущий год"
        onChange={(e) => {
          const y = Number(e.target.value);
          if (Number.isInteger(y) && y >= MIN_YEAR && y <= MAX_YEAR) setYear(y);
        }}
        className="w-16 text-center text-sm font-semibold text-text-primary bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        title="Следующий год (тот же день и месяц)"
        aria-label="Следующий год"
        className={btnClass}
        disabled={currentYear >= MAX_YEAR}
        onClick={() => stepYear(1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function CURRENT_NOW_YEAR(): number {
  return Number(todayIso().slice(0, 4));
}
