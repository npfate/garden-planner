import type { GardenObjectType } from '../types/garden';

// Библиотека объектов — КАТАЛОГ ТИПОВ, которые можно разместить на схеме.
// Аналогия: палитра в CAD / библиотека компонентов в Figma.
// Не путать с Инвентарём (список уже размещённых экземпляров).

export interface LibraryCategory {
  id: string;
  name: string;
  icon: string; // имя иконки из lucide-react
  children?: LibraryCategory[];
  items?: LibraryItem[];
}

export interface LibraryItem {
  id: string;
  name: string;
  category: LibraryCategoryId; // категория верхнего уровня для группировки
  subcategory?: string; // id дочерней категории ("trees" | "fruit_trees" | "bushes")
  icon: string; // имя иконки из lucide-react
  objectType: GardenObjectType; // тип объекта в сторе/на канвасе
  defaultProperties: Partial<Record<string, unknown>>;
}

export type LibraryCategoryId =
  | 'building'
  | 'tree'
  | 'fruit_tree'
  | 'bush'
  | 'flower'
  | 'shrub'
  | 'seedling';

const bedDefaults = { width: 2, height: 1 };
const structureDefaults = { width: 3, height: 2 };
const treeDefaults = { crownDiameter: 3 };
const bushDefaults = { crownDiameter: 0.8 };
const flowerDefaults = { crownDiameter: 0.3 };
const seedlingDefaults = { count: 1 };

export const OBJECT_LIBRARY: LibraryCategory[] = [
  {
    id: 'buildings',
    name: 'Постройки',
    icon: 'Home',
    items: [
      { id: 'bed', name: 'Грядка', category: 'building', icon: 'LayoutGrid', objectType: 'bed', defaultProperties: { ...bedDefaults } },
      { id: 'greenhouse', name: 'Парник', category: 'building', icon: 'Tent', objectType: 'greenhouse', defaultProperties: { ...structureDefaults } },
      { id: 'shed', name: 'Сарай', category: 'building', icon: 'Warehouse', objectType: 'building', defaultProperties: { ...structureDefaults } },
      { id: 'house', name: 'Дом', category: 'building', icon: 'Home', objectType: 'building', defaultProperties: { width: 6, height: 4 } },
      { id: 'canopy', name: 'Навес', category: 'building', icon: 'Umbrella', objectType: 'building', defaultProperties: { ...structureDefaults } },
      { id: 'well', name: 'Колодец', category: 'building', icon: 'Droplets', objectType: 'custom', defaultProperties: { crownDiameter: 1 } },
      { id: 'banya', name: 'Баня', category: 'building', icon: 'Flame', objectType: 'building', defaultProperties: { width: 4, height: 3 } },
      { id: 'fence', name: 'Забор', category: 'building', icon: 'Minus', objectType: 'path', defaultProperties: { width: 4, height: 0.2 } },
      { id: 'gazebo', name: 'Беседка', category: 'building', icon: 'CircleDot', objectType: 'building', defaultProperties: { crownDiameter: 2.5 } },
      { id: 'grill', name: 'Мангал', category: 'building', icon: 'FlameKindling', objectType: 'custom', defaultProperties: { crownDiameter: 0.8 } },
      { id: 'toilet', name: 'Туалет', category: 'building', icon: 'DoorOpen', objectType: 'building', defaultProperties: { width: 1.5, height: 1.5 } },
      { id: 'compost', name: 'Компост', category: 'building', icon: 'Recycle', objectType: 'custom', defaultProperties: { ...structureDefaults } },
      { id: 'path', name: 'Тропинка', category: 'building', icon: 'Route', objectType: 'path', defaultProperties: { width: 5, height: 0.8 } },
    ],
  },
  {
    id: 'plants',
    name: 'Растения',
    icon: 'TreePine',
    children: [
      {
        id: 'trees',
        name: 'Деревья',
        icon: 'TreePine',
        items: [
          { id: 'birch', name: 'Берёза', category: 'tree', subcategory: 'trees', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { ...treeDefaults } },
          { id: 'pine', name: 'Сосна', category: 'tree', subcategory: 'trees', icon: 'TreePine', objectType: 'tree', defaultProperties: { ...treeDefaults } },
          { id: 'spruce', name: 'Ель', category: 'tree', subcategory: 'trees', icon: 'TreePine', objectType: 'tree', defaultProperties: { ...treeDefaults } },
          { id: 'hazel', name: 'Орешник', category: 'tree', subcategory: 'trees', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 2.5 } },
          { id: 'oak', name: 'Дуб', category: 'tree', subcategory: 'trees', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 4 } },
        ],
      },
      {
        id: 'fruit_trees',
        name: 'Плодовые',
        icon: 'Apple',
        items: [
          { id: 'apple', name: 'Яблоня', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 3, varieties: [] } },
          { id: 'pear', name: 'Груша', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 3, varieties: [] } },
          { id: 'plum', name: 'Слива', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 2.5, varieties: [] } },
          { id: 'cherry', name: 'Вишня', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 2, varieties: [] } },
          { id: 'sweetcherry', name: 'Черешня', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 2.5, varieties: [] } },
        ],
      },
      {
        id: 'bushes',
        name: 'Кустовые',
        icon: 'Flower2',
        items: [
          { id: 'gooseberry', name: 'Крыжовник', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults } },
          { id: 'black_currant', name: 'Чёрная смородина', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults } },
          { id: 'red_currant', name: 'Красная смородина', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults } },
          { id: 'pink_currant', name: 'Розовая смородина', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults } },
          { id: 'raspberry', name: 'Малина', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults } },
          { id: 'blackberry', name: 'Ежевика', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults } },
          { id: 'strawberry', name: 'Клубника', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
          { id: 'wild_strawberry', name: 'Земляника', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
        ],
      },
    ],
  },
  {
    id: 'flowers',
    name: 'Цветы',
    icon: 'Flower',
    items: [
      { id: 'lily', name: 'Лилии', category: 'flower', icon: 'Flower', objectType: 'tree', defaultProperties: { ...flowerDefaults } },
      { id: 'orchid', name: 'Орхидеи', category: 'flower', icon: 'Flower', objectType: 'tree', defaultProperties: { ...flowerDefaults } },
      { id: 'rose', name: 'Розы', category: 'flower', icon: 'Flower', objectType: 'tree', defaultProperties: { crownDiameter: 0.5 } },
      { id: 'tulip', name: 'Тюльпаны', category: 'flower', icon: 'Flower', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
    ],
  },
  {
    id: 'shrubs',
    name: 'Кустарники',
    icon: 'TreeDeciduous',
    items: [
      { id: 'spirea', name: 'Спирея', category: 'shrub', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 1 } },
      { id: 'lilac', name: 'Сирень', category: 'shrub', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 2 } },
      { id: 'hydrangea', name: 'Гортензия', category: 'shrub', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 1.2 } },
    ],
  },
  {
    id: 'seedlings',
    name: 'Саженцы',
    icon: 'Sprout',
    items: [
      { id: 'potato', name: 'Картошка', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
      { id: 'cucumber', name: 'Огурцы', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
      { id: 'tomato', name: 'Помидоры', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
      { id: 'onion', name: 'Лук', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
      { id: 'garlic', name: 'Чеснок', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
      { id: 'pepper', name: 'Перец', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults } },
    ],
  },
];

// Плоский список всех элементов библиотеки (для поиска и получения по id)
export const LIBRARY_ITEMS_FLAT: LibraryItem[] = OBJECT_LIBRARY.flatMap((cat) => [
  ...(cat.items ?? []),
  ...(cat.children?.flatMap((child) => child.items ?? []) ?? []),
]);

export function getLibraryItem(id: string): LibraryItem | undefined {
  return LIBRARY_ITEMS_FLAT.find((item) => item.id === id);
}
