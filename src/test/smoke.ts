// Smoke-тесты Спринта 5 (Шаг 9): чистые функции без React/canvas.
// Запуск: npm run test:smoke
import { OBJECT_LIBRARY, LIBRARY_ITEMS_FLAT, getLibraryItem } from '../constants/objectLibrary';
import { filterVisible, isVisibleAt, makeEvent } from '../utils/wayback';
import type { GardenObject, ActivityEvent } from '../types/garden';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${name}`);
  } else {
    console.log(`ok:   ${name}`);
  }
}

function base(over: Partial<GardenObject>): GardenObject {
  return {
    id: 'o1',
    type: 'tree',
    name: 'Тест',
    year: 2026,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    parentId: null,
    varieties: [],
    history: {},
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

// --- 1. Библиотека: иерархия и индексы согласованы ---
check('library: каждый элемент плоского списка существует в lookup', LIBRARY_ITEMS_FLAT.every((i) => getLibraryItem(i.id) === i));
check('library: bed и apple-tree доступны как шаблоны', LIBRARY_ITEMS_FLAT.some((i) => i.id === 'bed') && LIBRARY_ITEMS_FLAT.some((i) => i.objectType === 'tree'));
let nestedCount = 0;
const walk = (cats: typeof OBJECT_LIBRARY): void => {
  for (const c of cats) {
    nestedCount += c.items?.length ?? 0;
    if (c.children) walk(c.children);
  }
};
walk(OBJECT_LIBRARY);
check(`library: вложенные элементы (${nestedCount}) совпадают с плоским списком (${LIBRARY_ITEMS_FLAT.length})`, nestedCount === LIBRARY_ITEMS_FLAT.length);

// --- 2. Wayback-фильтр: единая модель для канваса и Инвентаря ---
const perennial = base({ id: 'p', plantedAt: '2024-05-01' });
const annual = base({ id: 'a', lifecycle: 'annual', plantedAt: '2026-03-01' });
const dug = base({ id: 'd', plantedAt: '2024-05-01', removedAt: '2026-07-10' });
check('wayback: многолетник виден в год посадки', isVisibleAt(perennial, 2026));
check('wayback: однолетник не виден в следующем году', !isVisibleAt(annual, 2027));
check('wayback: выкопанный скрыт «на сегодня» (осень 2026)', !isVisibleAt(dug, 2026, '2026-10-07'));
check('wayback: выкопанный виден до даты выкопки', isVisibleAt(dug, 2026, '2026-07-01'));

// Пересадка: промежуточное место скрыто, пока живое следующее
const oldSpot = base({ id: 'old', plantedAt: '2024-05-01', removedAt: '2026-08-01', transplantedToId: 'new' });
const newSpot = base({ id: 'new', plantedAt: '2026-08-01', transplantedFromId: 'old' });
const vis = filterVisible([oldSpot, newSpot], 2026, '2026-10-07');
check('wayback: после пересадки видно только новое место', vis.length === 1 && vis[0].id === 'new');
const afterDugNew = filterVisible([oldSpot, { ...newSpot, removedAt: '2026-09-01' }], 2026, '2026-10-07');
// removedAt — дата последнего дня жизни: старое место «оживает», если
// следующее место выкопано не позже самого старого (на 2026-08-01 живы оба
// звена цепочки, но актуальным считается старое — новое уже мертво).
const revivedOld = filterVisible([oldSpot, { ...newSpot, removedAt: '2026-07-15' }], 2026, '2026-08-01');
check('wayback: если новое место выкопано раньше — старое снова актуально', revivedOld.some((o) => o.id === 'old'));
check('wayback: позднее даты выкопки обоих мест старое не видно', !afterDugNew.some((o) => o.id === 'old'));

// --- 3. Журнал событий ---
const ev: ActivityEvent = makeEvent('planted', perennial, 'Посадка: Тест');
check('events: событие содержит objectId и дату', ev.objectId === 'p' && /^\d{4}-\d{2}-\d{2}/.test(ev.date));

if (failures > 0) {
  console.error(`\nПровалено тестов: ${failures}`);
  process.exit(1);
} else {
  console.log('\nВсе smoke-тесты пройдены.');
}
