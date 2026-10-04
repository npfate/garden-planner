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

export default function Sidebar() {
  return (
    <aside className="w-[250px] panel z-10 flex flex-col flex-shrink-0">
      <div className="panel-header">Навигация</div>
      <nav className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'text-text-secondary hover:bg-background hover:text-text-primary'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
