export default function GardenCanvas() {
  return (
    <div className="relative w-full h-full">
      <div
        className="w-full h-full flex items-center justify-center text-text-secondary select-none"
        style={{ backgroundColor: '#E5E7EB', border: '1px solid #D1D5DB' }}
      >
        Canvas Area (Fabric.js будет здесь)
      </div>
    </div>
  );
}
