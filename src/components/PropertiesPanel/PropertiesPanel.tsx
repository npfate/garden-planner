import { useGardenStore } from '../../store/gardenStore';

export default function PropertiesPanel() {
  const selectedObjectId = useGardenStore((s) => s.selectedObjectId);
  const object = useGardenStore((s) =>
    s.objects.find((item) => item.id === s.selectedObjectId) ?? null,
  );
  const updateObject = useGardenStore((s) => s.updateObject);

  if (!selectedObjectId || !object) {
    return (
      <aside className="w-[300px] panel z-10 flex flex-col flex-shrink-0">
        <div className="panel-header">Свойства</div>
        <div className="flex-1 p-6 flex items-center justify-center text-text-secondary text-center text-sm select-none">
          Выберите объект
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[300px] panel z-10 flex flex-col flex-shrink-0">
      <div className="panel-header">Свойства</div>
      <div className="flex-1 p-4 space-y-4 text-sm text-text-primary">
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wide text-text-secondary">
            Название
          </label>
          <input
            type="text"
            value={object.name}
            onChange={(event) => updateObject(object.id, { name: event.target.value })}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wide text-text-secondary">
            Тип
          </label>
          <input
            type="text"
            value={object.type}
            readOnly
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wide text-text-secondary">
            Год
          </label>
          <input
            type="number"
            value={object.year}
            onChange={(event) => updateObject(object.id, { year: Number(event.target.value) })}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wide text-text-secondary">
              X
            </label>
            <input
              type="text"
              value={object.x}
              readOnly
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wide text-text-secondary">
              Y
            </label>
            <input
              type="text"
              value={object.y}
              readOnly
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wide text-text-secondary">
              Width
            </label>
            <input
              type="text"
              value={object.width}
              readOnly
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wide text-text-secondary">
              Height
            </label>
            <input
              type="text"
              value={object.height}
              readOnly
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wide text-text-secondary">
            Угол поворота
          </label>
          <input
            type="text"
            value={object.rotation ?? 0}
            readOnly
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary"
          />
        </div>
      </div>
    </aside>
  );
}
