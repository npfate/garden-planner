export default function PropertiesPanel() {
  return (
    <aside className="w-[300px] panel z-10 flex flex-col flex-shrink-0">
      <div className="panel-header">Свойства</div>
      <div className="flex-1 p-6 flex items-center justify-center text-text-secondary text-center text-sm select-none">
        Выберите объект
      </div>
    </aside>
  );
}
