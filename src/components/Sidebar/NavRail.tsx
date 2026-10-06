import {
  LayoutGrid,
  Package,
  BarChart3,
  Notebook,
  CalendarDays,
  Settings,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Схема', icon: LayoutGrid },
  { to: '/inventory', label: 'Инвентарь', icon: Package },
  { to: '/reports', label: 'Отчёты', icon: BarChart3 },
  { to: '/diary', label: 'История', icon: Notebook },
  { to: '/planner', label: 'Планировщик', icon: CalendarDays },
  { to: '/settings', label: 'Настройки', icon: Settings },
];

/**
 * Компактная вертикальная навигация (Вариант A левой панели):
 * узкая полоса с иконками всех страниц. Подсказка названия — через title.
 */
export default function NavRail() {
  return (
    <aside className="w-14 panel z-10 flex flex-col items-center py-2 gap-1 flex-shrink-0">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          aria-label={label}
          className={({ isActive }) =>
            `w-10 h-10 flex items-center justify-center rounded-md transition-colors ${
              isActive
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-background hover:text-text-primary'
            }`
          }
        >
          <Icon size={20} />
        </NavLink>
      ))}
    </aside>
  );
}
