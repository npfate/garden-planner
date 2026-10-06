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

// Свойства шаблона, которые Панель свойств показывает как «подсказки» при
// выборе экземпляра, созданного из этого шаблона.
export interface LibraryTemplateMeta {
  description?: string; // короткая агросправка
  heightM?: number; // взрослое высота, м
  spacingM?: number; // рекомендованное расстояние между растениями, м
  frostResistance?: 'низкая' | 'средняя' | 'высокая';
  ripening?: string; // сроки созревания / цветения
}

export interface LibraryItem {
  id: string;
  name: string;
  category: LibraryCategoryId; // категория верхнего уровня для группировки
  subcategory?: string; // id дочерней категории ("trees" | "fruit_trees" | "bushes")
  icon: string; // имя иконки из lucide-react
  objectType: GardenObjectType; // тип объекта в сторе/на канвасе
  defaultProperties: Partial<Record<string, unknown>>;
  meta?: LibraryTemplateMeta;
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
      { id: 'bed', name: 'Грядка', category: 'building', icon: 'LayoutGrid', objectType: 'bed', defaultProperties: { ...bedDefaults }, meta: {"description": "Овощная грядка; ориентировать с севера на юг, плодородный слой 20–40 см."} },
      { id: 'greenhouse', name: 'Парник', category: 'building', icon: 'Tent', objectType: 'greenhouse', defaultProperties: { ...structureDefaults }, meta: {"description": "Парник; размещать длинной осью восток–запад для равномерного освещения."} },
      { id: 'shed', name: 'Сарай', category: 'building', icon: 'Warehouse', objectType: 'building', defaultProperties: { ...structureDefaults }, meta: {"description": "Хозяйственный сарай для инвентаря и материалов."} },
      { id: 'house', name: 'Дом', category: 'building', icon: 'Home', objectType: 'building', defaultProperties: { width: 6, height: 4 }, meta: {"description": "Жилой дом; соблюдать пожарные отступы от границы участка — 3–5 м."} },
      { id: 'canopy', name: 'Навес', category: 'building', icon: 'Umbrella', objectType: 'building', defaultProperties: { ...structureDefaults }, meta: {"description": "Навес из легких конструкций; учитывать розу ветров."} },
      { id: 'well', name: 'Колодец', category: 'building', icon: 'Droplets', objectType: 'custom', defaultProperties: { crownDiameter: 1 }, meta: {"spacingM": 3, "description": "Колодец; не ближе 3 м к компосту и туалету (санитарные нормы)."} },
      { id: 'banya', name: 'Баня', category: 'building', icon: 'Flame', objectType: 'building', defaultProperties: { width: 4, height: 3 }, meta: {"description": "Баня; отступ от жилого дома не менее 8 м по пожарным нормам."} },
      { id: 'fence', name: 'Забор', category: 'building', icon: 'Minus', objectType: 'path', defaultProperties: { width: 4, height: 0.2 }, meta: {"description": "Забор; высота до 1,5 м со стороны соседей без согласования."} },
      { id: 'gazebo', name: 'Беседка', category: 'building', icon: 'CircleDot', objectType: 'building', defaultProperties: { crownDiameter: 2.5 }, meta: {"spacingM": 3, "description": "Беседка; ровное основание, отступ от деревьев — 3 м."} },
      { id: 'grill', name: 'Мангал', category: 'building', icon: 'FlameKindling', objectType: 'custom', defaultProperties: { crownDiameter: 0.8 }, meta: {"description": "Мангал; не ближе 5 м к строениям и древесно-кустарниковым посадкам."} },
      { id: 'toilet', name: 'Туалет', category: 'building', icon: 'DoorOpen', objectType: 'building', defaultProperties: { width: 1.5, height: 1.5 }, meta: {"spacingM": 8, "description": "Уличный туалет; не ближе 8 м к колодцу и источникам воды."} },
      { id: 'compost', name: 'Компост', category: 'building', icon: 'Recycle', objectType: 'custom', defaultProperties: { ...structureDefaults }, meta: {"spacingM": 8, "description": "Компостная куча; не ближе 8 м к колодцу, с отступом от жилых построек."} },
      { id: 'path', name: 'Тропинка', category: 'building', icon: 'Route', objectType: 'path', defaultProperties: { width: 5, height: 0.8 }, meta: {"description": "Тропинка; ширина 0,6–0,9 м для одного человека, 1,2+ м для тачки."} },
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
          { id: 'birch', name: 'Берёза', category: 'tree', subcategory: 'trees', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { ...treeDefaults }, meta: {"heightM": 25, "spacingM": 4, "frostResistance": "высокая", "description": "Быстрорастущая светолюбивая порода; корни поверхностные — не сажать близко к постройкам."} },
          { id: 'pine', name: 'Сосна', category: 'tree', subcategory: 'trees', icon: 'TreePine', objectType: 'tree', defaultProperties: { ...treeDefaults }, meta: {"heightM": 30, "spacingM": 4, "frostResistance": "высокая", "description": "Морозостойка, нетребовательна к почвам; хорошо растёт на песчаных грунтах."} },
          { id: 'spruce', name: 'Ель', category: 'tree', subcategory: 'trees', icon: 'TreePine', objectType: 'tree', defaultProperties: { ...treeDefaults }, meta: {"heightM": 30, "spacingM": 3, "frostResistance": "высокая", "description": "Теневынослива, но требовательна к влажности воздуха и почвы."} },
          { id: 'hazel', name: 'Орешник', category: 'tree', subcategory: 'trees', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 2.5 }, meta: {"heightM": 4, "spacingM": 3, "frostResistance": "средняя", "ripening": "сентябрь", "description": "Орешник; требует перекрёстного опыления — сажать минимум 2–3 растения."} },
          { id: 'oak', name: 'Дуб', category: 'tree', subcategory: 'trees', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 4 }, meta: {"heightM": 30, "spacingM": 5, "frostResistance": "средняя", "description": "Мощная корневая система; закладывать не ближе 5 м к фундаменту."} },
        ],
      },
      {
        id: 'fruit_trees',
        name: 'Плодовые',
        icon: 'Apple',
        items: [
          { id: 'apple', name: 'Яблоня', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 3, varieties: [] }, meta: {"heightM": 5, "spacingM": 3, "frostResistance": "высокая", "ripening": "август–октябрь", "description": "Светолюбива; подвой определяет итоговую высоту и схему посадки."} },
          { id: 'pear', name: 'Груша', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 3, varieties: [] }, meta: {"heightM": 5, "spacingM": 3, "frostResistance": "средняя", "ripening": "сентябрь–октябрь", "description": "Теплолюбивее яблони; лучшие южные склоны, защита от ветра."} },
          { id: 'plum', name: 'Слива', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 2.5, varieties: [] }, meta: {"heightM": 3, "spacingM": 2.5, "frostResistance": "средняя", "ripening": "июль–сентябрь", "description": "Требует опылителей; быстро даёт поросль, которую нужно удалять."} },
          { id: 'cherry', name: 'Вишня', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 2, varieties: [] }, meta: {"heightM": 3, "spacingM": 2.5, "frostResistance": "высокая", "ripening": "июнь–июль", "description": "Не переносит переувлажнения; закладывать на возвышении."} },
          { id: 'sweetcherry', name: 'Черешня', category: 'fruit_tree', subcategory: 'fruit_trees', icon: 'Apple', objectType: 'tree', defaultProperties: { crownDiameter: 2.5, varieties: [] }, meta: {"heightM": 8, "spacingM": 4, "frostResistance": "низкая", "ripening": "июнь–июль", "description": "Черешня теплолюбива; обязательны зимостойкие подвои и опылители."} },
        ],
      },
      {
        id: 'bushes',
        name: 'Кустовые',
        icon: 'Flower2',
        items: [
          { id: 'gooseberry', name: 'Крыжовник', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults }, meta: {"heightM": 1.2, "spacingM": 1.5, "frostResistance": "высокая", "ripening": "июль", "description": "Крыжовник; устойчив к мучнистой росе — выбирать сорта «Финик» и аналоги."} },
          { id: 'black_currant', name: 'Чёрная смородина', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults }, meta: {"heightM": 1.5, "spacingM": 1.5, "frostResistance": "высокая", "ripening": "июль–август", "description": "Теневынослива; любит влагу, обрезка старых ветвей каждые 4–5 лет."} },
          { id: 'red_currant', name: 'Красная смородина', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults }, meta: {"heightM": 1.5, "spacingM": 1.3, "frostResistance": "высокая", "ripening": "июль", "description": "Засухоустойчивее чёрной; дольше держит урожай на старых ветвях."} },
          { id: 'pink_currant', name: 'Розовая смородина', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults }, meta: {"heightM": 1.2, "spacingM": 1.2, "frostResistance": "высокая", "ripening": "июль–август", "description": "Розовая смородина; самоплодна, компактный куст."} },
          { id: 'raspberry', name: 'Малина', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults }, meta: {"heightM": 1.8, "spacingM": 0.7, "frostResistance": "средняя", "ripening": "июль–сентябрь", "description": "Малина; шпалера обязательна, осенью вырезать отплодоносившие побеги."} },
          { id: 'blackberry', name: 'Ежевика', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'tree', defaultProperties: { ...bushDefaults }, meta: {"heightM": 2.0, "spacingM": 1.0, "frostResistance": "низкая", "ripening": "август–сентябрь", "description": "Ежевика; в холодных регионах — укрывной режим или морозостойкие бесшипые сорта."} },
          { id: 'strawberry', name: 'Клубника', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"heightM": 0.3, "spacingM": 0.3, "frostResistance": "средняя", "ripening": "июнь–июль", "description": "Клубника; обновлять плантацию каждые 3–4 года, мульчировать."} },
          { id: 'wild_strawberry', name: 'Земляника', category: 'bush', subcategory: 'bushes', icon: 'Flower2', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"heightM": 0.2, "spacingM": 0.2, "frostResistance": "высокая", "ripening": "июнь–июль", "description": "Земляника лесная; теневынослива, почвопокровный вариант."} },
        ],
      },
    ],
  },
  {
    id: 'flowers',
    name: 'Цветы',
    icon: 'Flower',
    items: [
      { id: 'lily', name: 'Лилии', category: 'flower', icon: 'Flower', objectType: 'tree', defaultProperties: { ...flowerDefaults }, meta: {"heightM": 1.0, "spacingM": 0.25, "frostResistance": "средняя", "ripening": "цветение VI–VIII", "description": "Лилии; дренаж обязателен, луковицы не переносят застоя воды."} },
      { id: 'orchid', name: 'Орхидеи', category: 'flower', icon: 'Flower', objectType: 'tree', defaultProperties: { ...flowerDefaults }, meta: {"heightM": 0.5, "frostResistance": "низкая", "description": "Садовая орхидея (любка/венерин башмачок); кислая дренированная почва, без пересадок."} },
      { id: 'rose', name: 'Розы', category: 'flower', icon: 'Flower', objectType: 'tree', defaultProperties: { crownDiameter: 0.5 }, meta: {"heightM": 1.5, "spacingM": 0.5, "frostResistance": "средняя", "ripening": "цветение VI–IX", "description": "Розы; солнечное место, защита от холодных ветров, ежегодная обрезка."} },
      { id: 'tulip', name: 'Тюльпаны', category: 'flower', icon: 'Flower', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"heightM": 0.4, "spacingM": 0.15, "frostResistance": "высокая", "ripening": "цветение IV–V", "description": "Тюльпаны; однолетнее высаживание осенних луковичных, выкопка после пожелтения листа."} },
    ],
  },
  {
    id: 'shrubs',
    name: 'Кустарники',
    icon: 'TreeDeciduous',
    items: [
      { id: 'spirea', name: 'Спирея', category: 'shrub', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 1 }, meta: {"heightM": 1.5, "spacingM": 0.8, "frostResistance": "высокая", "ripening": "цветение V–VII", "description": "Спирея; формующая стрижка после цветения, живучая городская культура."} },
      { id: 'lilac', name: 'Сирень', category: 'shrub', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 2 }, meta: {"heightM": 4, "spacingM": 2, "frostResistance": "высокая", "ripening": "цветение V–VI", "description": "Сирень; светолюбива, плохо переносит близость грунтовых вод."} },
      { id: 'hydrangea', name: 'Гортензия', category: 'shrub', icon: 'TreeDeciduous', objectType: 'tree', defaultProperties: { crownDiameter: 1.2 }, meta: {"heightM": 1.5, "spacingM": 1, "frostResistance": "средняя", "ripening": "цветение VII–IX", "description": "Гортензия; полутень, кислая почва; крупнолистную — укрывать на зиму."} },
    ],
  },
  {
    id: 'seedlings',
    name: 'Саженцы',
    icon: 'Sprout',
    items: [
      { id: 'potato', name: 'Картошка', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"spacingM": 0.6, "ripening": "сбор VII–IX", "description": "Картофель; окучивание 2–3 раза за сезон, севооборот — возвращать на место через 3–4 года."} },
      { id: 'cucumber', name: 'Огурцы', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"spacingM": 0.4, "ripening": "сбор VI–VIII", "description": "Огурцы; вертикальная шпалера экономит площадь, полив тёплой водой."} },
      { id: 'tomato', name: 'Помидоры', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"spacingM": 0.5, "ripening": "сбор VII–IX", "description": "Помидоры; пасынкование индетерминантных сортов, подвязка обязательна."} },
      { id: 'onion', name: 'Лук', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"spacingM": 0.2, "ripening": "сбор VII–VIII", "description": "Лук; не переносит свежего навоза, предшественники — огурцы, кабачки."} },
      { id: 'garlic', name: 'Чеснок', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"spacingM": 0.2, "ripening": "сбор VII (озимый)", "description": "Чеснок; озимый — под зиму, яровой — ранней весной."} },
      { id: 'pepper', name: 'Перец', category: 'seedling', icon: 'Sprout', objectType: 'seedling', defaultProperties: { ...seedlingDefaults }, meta: {"spacingM": 0.4, "ripening": "сбор VIII–IX", "description": "Перец; теплолюбив, не переносит заморозков, рассадный метод."} },
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

// Плоский список всех категорий (верхний уровень + дочерние подкатегории).
// Нужен для отображения пути категории в UI (Инвентарь, поиск).
export const ALL_CATEGORIES_FLAT: LibraryCategory[] = OBJECT_LIBRARY.flatMap(
  (cat) => [cat, ...(cat.children ?? [])],
);

export function getCategoryName(categoryId: string): string {
  return ALL_CATEGORIES_FLAT.find((c) => c.id === categoryId)?.name ?? '';
}

// «Растения» — категории, которые можно размещать ВНУТРИ грядок/парников
// (при клике по контейнеру активным инструментом размещения). Постройки,
// тропы и прочая инфраструктура внутрь контейнера не сажаются.
const PLANT_CATEGORY_IDS: LibraryCategoryId[] = ['tree', 'fruit_tree', 'bush', 'flower', 'shrub', 'seedling'];

/** Является ли шаблон библиотеки растением (дерево/куст/цветок/саженец)? */
export function isPlantLibraryItem(itemId: string): boolean {
  const item = getLibraryItem(itemId);
  return !!item && PLANT_CATEGORY_IDS.includes(item.category);
}

/** Инструмент размещения растения? Принимает 'place:<itemId>' и legacy 'tree'. */
export function isPlantTool(toolId: string): boolean {
  if (toolId === 'tree') return true; // legacy-инструмент «Яблоня»
  if (!toolId.startsWith('place:')) return false;
  return isPlantLibraryItem(toolId.slice('place:'.length));
}
