import { Outlet } from 'react-router-dom';
import Toolbar from '../Toolbar/Toolbar';
import Sidebar from '../Sidebar/Sidebar';
import PropertiesPanel from '../PropertiesPanel/PropertiesPanel';
import { useGardenStore } from '../../store/gardenStore';

export default function MainLayout() {
  const scale = useGardenStore((s) => s.scale);

  return (
    <div className="w-screen h-screen flex flex-col bg-background text-text-primary">
      <Toolbar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 relative min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <Outlet />
          </div>
          <div className="absolute right-4 bottom-3 px-3 py-1 rounded-md bg-surface shadow-panel text-xs text-text-secondary select-none border border-border z-20">
            {scale}%
          </div>
        </main>
        <PropertiesPanel />
      </div>
    </div>
  );
}
