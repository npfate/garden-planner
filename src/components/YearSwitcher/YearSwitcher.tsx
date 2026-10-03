import { useRef } from 'react';
import type { MouseEvent } from 'react';
import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGardenStore } from '../../store/gardenStore';
import type { IsoDate } from '../../types/garden';
import { shiftIsoDate, todayIso } from '../../utils/markers';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

// Wayback machine: переключение года + точной даты просмотра схемы.
// Дата по умолчанию — сегодня; клик по полю открывает нативный календарь;
// стрелки сдвигают дату просмотра на один день.
export default function YearSwitcher() {
  const currentYear = useGardenStore((s) => s.currentYear);
  const viewDate = useGardenStore((s) => s.viewDate);
  const setYear = useGardenStore((s) => s.setYear);
  const setViewDate = useGardenStore((s) => s.setViewDate);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const btnClass =
    'w-8 h-8 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const onDateChange = (value: string): void => {
    if (!value) {
      setViewDate(null);
      return;
    }
    setViewDate(value as IsoDate);
  };

  // Сдвиг точной даты просмотра на ±1 день (wayback machine).
  const stepDay = (days: number): void => {
    const base = viewDate ?? todayIso();
    setViewDate(shiftIsoDate(base, days));
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
      {/* Точная дата просмотра («wayback»), null = конец года */}
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
          value={viewDate ?? todayIso()}
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
      {viewDate && (
        <button
          type="button"
          title="Вернуться к годовому режиму"
          aria-label="Сбросить дату"
          className={btnClass}
          onClick={() => setViewDate(null)}
        >
          <CalendarX2 size={16} />
        </button>
      )}
      <div className="w-px h-6 bg-border" />
      <button
        type="button"
        title="Предыдущий год"
        aria-label="Предыдущий год"
        className={btnClass}
        disabled={currentYear <= MIN_YEAR}
        onClick={() => setYear(Math.max(MIN_YEAR, currentYear - 1))}
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
        title="Следующий год"
        aria-label="Следующий год"
        className={btnClass}
        disabled={currentYear >= MAX_YEAR}
        onClick={() => setYear(Math.min(MAX_YEAR, currentYear + 1))}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
