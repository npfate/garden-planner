import GardenCanvas from '../components/Canvas/GardenCanvas';

// Схема — единственный «живой» экран с canvas.
// GardenCanvas монтируется здесь один раз и переживает переходы между
// вкладками: MainLayout скрывает этот блок через CSS, не размонтируя его,
// поэтому объекты на схеме не стираются и не пересоздаются.
export default function SchemaPage() {
  return <GardenCanvas />;
}
