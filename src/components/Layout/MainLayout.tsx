import { Outlet, useLocation } from 'react-router-dom';
import Toolbar from '../Toolbar/Toolbar';
import Sidebar from '../Sidebar/Sidebar';
import NavRail from '../Sidebar/NavRail';
import SchemaSidePanel from '../Sidebar/SchemaSidePanel';
import PropertiesPanel from '../PropertiesPanel/PropertiesPanel';
import YearSwitcher from '../YearSwitcher/YearSwitcher';
import { useCanvasStore } from '../../store/gardenStore';

const PAGE_TITLES: Record<string, string> = {
  '/inventory': 'Инвентарь',
  '/reports': 'Отчёты',
  '/diary': 'История сада',
  '/planner': 'Планировщик',
  '/settings': 'Настройки',
};

export default function MainLayout() {
  const location = useLocation();
  const scale = useCanvasStore((s) => s.scale);
  const isSchemaPage = location.pathname === '/';
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Схема';

  return (
    <div className="w-screen h-screen flex flex-col bg-background text-text-primary">
      {isSchemaPage ? <Toolbar /> : (
        <header className="h-12 flex items-center px-6 panel z-10 flex-shrink-0">
          <h1 className="font-bold text-text-primary select-none">{pageTitle}</h1>
        </header>
      )}
      <div className="flex-1 flex min-h-0">
        {/* Вариант A: узкая навигационная полоса NavRail присутствует на всех
            страницах, чтобы навигация не «пропадала» при переключении вкладок.
            На «Схеме» рядом с ней показывается панель Библиотека/Инвентарь,
            на остальных страницах — широкий Sidebar как раньше. */}
        <NavRail />
        {isSchemaPage ? <SchemaSidePanel /> : <Sidebar />}
        <main className="flex-1 relative min-w-0 min-h-0 flex flex-col">
          {/* Canvas (схема) монтируется один раз и скрывается через hidden при переходах
              между вкладками; все остальные страницы рендерятся без обёртки hidden */}
          {isSchemaPage ? (
            <div className="flex-1 min-h-0">
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
          {isSchemaPage && <YearSwitcher />}
          {isSchemaPage && (
            <div className="absolute right-4 bottom-3 px-3 py-1 rounded-md bg-surface shadow-panel text-xs text-text-secondary select-none border border-border z-20">
              {scale}%
            </div>
          )}
        </main>
        <PropertiesPanel />
      </div>
    </div>
  );
}
