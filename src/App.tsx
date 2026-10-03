
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import SchemaPage from './pages/SchemaPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import DiaryPage from './pages/DiaryPage';
import PlannerPage from './pages/PlannerPage';
import SettingsPage from './pages/SettingsPage';
import useAutosave from './hooks/useAutosave';

function AppRoutes() {
  useAutosave();

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<SchemaPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
