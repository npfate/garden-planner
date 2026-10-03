import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useGardenStore } from '../../store/gardenStore';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export default function YearSwitcher() {
  const currentYear = useGardenStore((s) => s.currentYear);
  const setYear = useGardenStore((s) => s.setYear);

  const btnClass =
    'w-8 h-8 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="absolute top-3 right-4 z-20 flex items-center gap-1 panel rounded-lg px-2 py-1 border border-border">
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
