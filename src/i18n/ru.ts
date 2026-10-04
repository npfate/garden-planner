/**
 * Словарь строк интерфейса (русский язык — базовая локаль).
 *
 * Формат «ключ: значение» рассчитан на переводы сообществом:
 * чтобы добавить язык, создайте файл en.ts (de.ts, ...) с тем же набором
 * ключей и зарегистрируйте его в src/i18n/index.ts.
 *
 * Соглашения по ключам:
 *  - <раздел>.<элемент> — группы: nav, toolbar, tools, canvas, properties,
 *    year, diary, inventory, pages, activity, errors;
 *  - значения {в фигурных скобках} — интерполируемые подстановки
 *    (например "properties.harvestTotal": "Урожай за {year} год, кг");
 *  - ключи не переименовывать без миграции существующих переводов.
 */
export const ru = {
  // ── Навигация (боковая панель) ────────────────────────────────────────────
  'nav.title': 'Навигация',
  'nav.schema': 'Схема',
  'nav.inventory': 'Инвентарь',
  'nav.reports': 'Отчёты',
  'nav.diary': 'Записи',
  'nav.planner': 'Планировщик',
  'nav.settings': 'Настройки',

  // ── Заголовки страниц ─────────────────────────────────────────────────────
  'pages.schemaTitle': 'Схема',
  'pages.inventoryLibrary': 'Библиотека объектов',
  'pages.inventoryRatings': 'Оценённые сорта',
  'pages.inventoryNoRatings':
    'Пока нет оценок. Ставьте 👍/👎 сортам в панели свойств на схеме.',
  'pages.reportsTitle': 'Отчёты',
  'pages.reportsPlaceholder': 'Здесь будут автогенерируемые отчёты.',
  'pages.diaryTitle': 'Журнал сада',
  'pages.diaryEmpty':
    'Пока пусто. Добавляйте, перемещайте и убирайте объекты на схеме, собирайте урожай — события появятся здесь.',
  'pages.diaryFilterAll': 'Все события',
  'pages.diaryFilterByType': 'Фильтр по типу',
  'pages.diaryYear': 'Год',
  'pages.diaryGoToSchema': 'На схеме →',
  'pages.plannerTitle': 'Планировщик',
  'pages.plannerPlaceholder': 'Здесь будет календарь посадок.',
  'pages.settingsTitle': 'Настройки',
  'pages.settingsPlaceholder': 'Здесь будут настройки приложения.',

  // ── Панель инструментов: секции ───────────────────────────────────────────
  'toolbar.toolsSection': 'Инструменты рисования',

  // ── Панель инструментов: инструменты ──────────────────────────────────────
  'tool.select': 'Выделение',
  'tool.pan': 'Рука (Перемещение схемы)',
  'tool.bed': 'Грядка',
  'tool.tree': 'Добавить дерево',

  // ── Панель инструментов: действия и подсказки (tooltips) ──────────────────
  'toolbar.zoomIn': 'Увеличить масштаб',
  'toolbar.zoomOut': 'Уменьшить масштаб',
  'toolbar.loadBackground': 'Загрузить фон',
  'toolbar.lockBackground': 'Закрепить фон',
  'toolbar.unlockBackground': 'Открепить фон',
  'toolbar.snapOn': 'Включить привязку к сетке',
  'toolbar.snapOff': 'Отключить привязку к сетке',
  'toolbar.saveProject': 'Сохранить проект',
  'toolbar.saveProjectHint': 'Сохранить проект (.garden)',
  'toolbar.openProject': 'Открыть проект',
  'toolbar.openProjectHint': 'Открыть проект (.garden)',

  // ── Холст ──────────────────────────────────────────────────────────────────
  'canvas.defaultTreeName': 'Яблоня',

  // ── Переключатель даты просмотра (wayback) ────────────────────────────────
  'year.viewDate': 'Дата просмотра',
  'year.currentYear': 'Текущий год',
  'year.pickDateHint': 'Смотреть сад на конкретную дату (клик — открыть календарь)',
  'year.prevDay': 'Предыдущий день',
  'year.nextDay': 'Следующий день',
  'year.prevYear': 'Предыдущий год',
  'year.nextYear': 'Следующий год',
  'year.prevYearSameDay': 'Предыдущий год (тот же день и месяц)',
  'year.nextYearSameDay': 'Следующий год (тот же день и месяц)',

  // ── Панель свойств объекта ────────────────────────────────────────────────
  'properties.title': 'Свойства',
  'properties.emptyHint': 'Выберите объект',
  'properties.name': 'Название',
  'properties.type': 'Тип',
  'properties.cycle': 'Цикл',
  'properties.perennial': 'Многолетник',
  'properties.annual': 'Однолетник',
  'properties.width': 'Ширина',
  'properties.height': 'Высота',
  'properties.plantedYear': 'Год посадки',
  'properties.transplantedAt': 'Пересажен {date}',
  'properties.transplantedArrowHint': ' — на схеме показана стрелка от прежнего места',
  'properties.removedAt':
    'Выкопан {date} — не виден на схеме после этой даты',
  'properties.harvestTotal': 'Урожай за {year} год, кг — всего {total}',
  'properties.harvestAmount': 'Сколько собрали',
  'properties.harvestCollect': 'Собрать',
  'properties.ratingLike': 'Нравится',
  'properties.ratingDislike': 'Не нравится',
  'properties.ratingLikeAria': 'Нравится сорт',
  'properties.ratingDislikeAria': 'Не нравится сорт',
  'properties.yearNotesPlaceholder': 'Заметки по году…',
  'properties.transplant': 'Пересадить (сохранит свойства на новом месте)',
  'properties.digOut': 'Выкопать (останется в истории по годам)',
  'properties.trash': 'В корзину (уничтожить во всех годах)',

  // ── Типы событий журнала (activity) ───────────────────────────────────────
  'activity.planted': 'Посадка',
  'activity.moved': 'Перемещение',
  'activity.harvest': 'Урожай',
  'activity.removed': 'Удаление',
  'activity.note': 'Заметка',

  // ── Предустановленный инвентарь ───────────────────────────────────────────
  'inventory.apple': 'Яблоня',
  'inventory.pear': 'Груша',
  'inventory.cherry': 'Вишня',
  'inventory.plum': 'Слива',
  'inventory.tomato': 'Томат',
  'inventory.cucumber': 'Огурец',
  'inventory.strawberry': 'Клубника',
  'inventory.greenhouse': 'Теплица',
  'inventory.barrel': 'Бочка',
  'inventory.well': 'Колодец',
  'inventory.fence': 'Забор',
  'inventory.gate': 'Калитка',

  // ── Сообщения об ошибках ──────────────────────────────────────────────────
  'errors.gardenFileRead':
    'Не удалось прочитать файл .garden — проверьте формат.',
} as const;

export type TranslationKey = keyof typeof ru;
export type Dictionary = Record<TranslationKey, string>;
