import { Switch } from "./switch";

/** A labelled setting: title and explanation on the left, toggle on the right. */
export function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2">
      <div className="flex flex-col py-1.5">
        <span className="text-base font-medium text-ink">{label}</span>
        {hint ? <span className="text-sm text-ink-muted">{hint}</span> : null}
      </div>
      <Switch label={label} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
