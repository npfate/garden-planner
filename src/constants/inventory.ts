import type { GardenObjectType } from '../types/garden';

export interface InventoryItem {
  id: string;
  name: string;
  type: GardenObjectType;
  icon: string; // эмодзи как иконка (Этап 2 — кастомные иконки)
}

// Предустановленный инвентарь (ROADMAP: Этап 1 — статический список)
export const INVENTORY_ITEMS: InventoryItem[] = [
  { id: 'apple', name: 'Яблоня', type: 'tree', icon: '🍎' },
  { id: 'pear', name: 'Груша', type: 'tree', icon: '🍐' },
  { id: 'cherry', name: 'Вишня', type: 'tree', icon: '🍒' },
  { id: 'plum', name: 'Слива', type: 'tree', icon: '🪻' },
  { id: 'tomato', name: 'Томат', type: 'seedling', icon: '🍅' },
  { id: 'cucumber', name: 'Огурец', type: 'seedling', icon: '🥒' },
  { id: 'strawberry', name: 'Клубника', type: 'seedling', icon: '🍓' },
  { id: 'greenhouse', name: 'Теплица', type: 'greenhouse', icon: '🏠' },
  { id: 'barrel', name: 'Бочка', type: 'custom', icon: '🛢️' },
  { id: 'well', name: 'Колодец', type: 'custom', icon: '⛲' },
  { id: 'gate', name: 'Калитка', type: 'custom', icon: '🚪' },
  { id: 'fence', name: 'Забор', type: 'custom', icon: '🚧' },
];
