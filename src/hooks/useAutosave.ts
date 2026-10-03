import { useEffect } from 'react';
import { useGardenStore } from '../store/gardenStore';

const AUTOSAVE_KEY = 'gardenplanner.autosave';
const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000; // каждые 5 минут (ТЗ п.7)

// Автосохранение проекта в localStorage + восстановление при запуске.
export default function useAutosave(): void {
  const saveToFile = useGardenStore((s) => s.saveToFile);
  const loadFromFile = useGardenStore((s) => s.loadFromFile);

  // Восстановление последнего автосейва при монтировании
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) loadFromFile(saved);
    } catch {
      // повреждённый автосейв — игнорируем
    }
    // выполняем один раз при старте приложения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, saveToFile());
      } catch {
        // переполнение хранилища (например, огромный base64-фон) — молча пропускаем
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [saveToFile]);

  // Синхронное сохранение при уходе со страницы
  useEffect(() => {
    const handler = (): void => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, saveToFile());
      } catch {
        // хранилище недоступно — пропускаем
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveToFile]);
}
