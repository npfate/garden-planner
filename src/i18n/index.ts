/**
 * Точка входа i18n.
 *
 * Как добавить язык (для сообщества переводчиков):
 *  1. Создайте файл вида en.ts по образцу ru.ts — тот же набор ключей,
 *     тип Dictionary гарантирует на этапе компиляции полноту перевода.
 *  2. Зарегистрируйте словарь в LOCALES ниже.
 *  3. Язык выбирается через localStorage('garden.locale') / navigator.language;
 *     переключатель появится на странице «Настройки» (Этап планирования UI).
 */
import { ru, type Dictionary, type TranslationKey } from './ru';

export const DEFAULT_LOCALE = 'ru';

export const dictionaries: Record<string, Dictionary> = {
  ru,
  // en: { ... }, // ← ваш перевод сюда
};

export type { TranslationKey };

/** Простейшая интерполяция: "Урожай за {year} год" + { year: 2026 }. */
export function translate(
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[DEFAULT_LOCALE];
  let text = dict[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Хелпер для JSX: t('nav.schema'). */
export const t = translate;
