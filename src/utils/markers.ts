import type { GardenObjectType } from '../types/garden';

export const MARKER_SIZE = 10;

// Контрастные цвета меток объектов для быстрого распознавания на схеме
const MARKER_COLORS: Record<GardenObjectType, string> = {
  tree: '#2E7D32',
  bed: '#8D6E63',
  seedling: '#00ACC1',
  greenhouse: '#F9A825',
  building: '#455A64',
  path: '#9E9E9E',
  custom: '#7B1FA2',
};

export function getMarkerColor(type: GardenObjectType): string {
  return MARKER_COLORS[type] ?? MARKER_COLORS.custom;
}
