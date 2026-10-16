import { missingOf, type Model, type Recipe } from "../model";

export function MissBadge({ m, r }: { m: Model; r: Recipe }) {
  if (!r.ing.length) return <span class="badge b-unk">brak składników</span>;
  const n = missingOf(m, r).length;
  return n === 0 ? <span class="badge b-ok">masz wszystko</span> : <span class="badge b-miss">brakuje {n}</span>;
}

export const Empty = ({ children }: { children: preact.ComponentChildren }) => <div class="empty">{children}</div>;

export function CheckRow(props: { checked?: boolean; disabled?: boolean; done?: boolean; onChange?: (checked: boolean) => void; label: string; sub?: string }) {
  return (
    <label class={`check ${props.done ? "done" : ""}`}>
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={e => props.onChange?.(e.currentTarget.checked)} />
      <span class="lbl">{props.label}{props.sub && <span class="sub">{props.sub}</span>}</span>
    </label>
  );
}
