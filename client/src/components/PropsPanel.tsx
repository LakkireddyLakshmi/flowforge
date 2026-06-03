import type { ComponentSpec } from '../types';
import { FIELDS, ICON } from '../editorTypes';

interface Props {
  node: ComponentSpec | null;
  onChange: (patch: Partial<ComponentSpec>) => void;
  onDelete: () => void;
}

/** The right-hand panel for editing the selected component's knobs. */
export function PropsPanel({ node, onChange, onDelete }: Props) {
  if (!node) {
    return (
      <aside className="props">
        <p className="props-empty">
          Add a component from the palette, then select it to tune its settings.
          To connect two components, press the <span className="dot-hint" /> dot
          on a node's right edge, then click the target.
        </p>
      </aside>
    );
  }

  const fields = FIELDS[node.type];

  return (
    <aside className="props">
      <div className="props-head">
        <span className="nb-icon">{ICON[node.type]}</span>
        <strong>{node.type}</strong>
      </div>

      <label className="field">
        <span>Label</span>
        <input value={node.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} />
      </label>

      {fields.map((f) => (
        <label className="field" key={String(f.key)}>
          <span>{f.label}</span>
          <input
            type="number"
            min={f.min}
            max={f.max}
            step={f.step}
            placeholder="default"
            value={node[f.key] === undefined ? '' : (node[f.key] as number)}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ [f.key]: v === '' ? undefined : Number(v) });
            }}
          />
        </label>
      ))}

      {fields.length === 0 && <p className="props-empty">This component has no settings.</p>}

      <button className="btn danger" onClick={onDelete}>
        🗑 Delete component
      </button>
    </aside>
  );
}
