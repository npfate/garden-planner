import { Outlet, useLocation } from 'react-router-dom';
import Toolbar from '../Toolbar/Toolbar';
import Sidebar from '../Sidebar/Sidebar';
import PropertiesPanel from '../PropertiesPanel/PropertiesPanel';
import { useGardenStore } from '../../store/gardenStore';
import SchemaPage from '../../pages/SchemaPage';

const PAGE_TITLES: Record<string, string> = {
  '/inventory': 'Инвентарь',
  '/reports': 'Отчёты',
  '/diary': 'Записи',
  '/planner': 'Планировщик',
  '/settings': 'Настройки',
};

export default function MainLayout() {
  const location = useLocation();
  const scale = useGardenStore((s) => s.scale);
  const isSchemaPage = location.pathname === '/';
  const pageTitle = PAGE_TITLES[location.pathname];

  return (
    <div className="w-screen h-screen flex flex-col bg-background text-text-primary">
      {isSchemaPage ? (
        <Toolbar />
      ) : (
        <header className="h-12 flex items-center px-6 panel z-10 flex-shrink-0">
          <h1 className="font-bold text-text-primary select-none">{pageTitle}</h1>
        </header>
      )}
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 relative min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <div className={isSchemaPage ? 'block h-full' : 'hidden h-full'}>
              <SchemaPage />
            </div>
            {!isSchemaPage && <Outlet />}
          </div>
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
