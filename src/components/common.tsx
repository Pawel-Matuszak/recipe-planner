import type { ReactNode } from "react";
import { missingOf, type Model, type Recipe } from "../model";

export function MissBadge({ m, r }: { m: Model; r: Recipe }) {
  if (!r.ing.length) return <span className="badge b-unk">brak składników</span>;
  const n = missingOf(m, r).length;
  return n === 0 ? <span className="badge b-ok">masz wszystko</span> : <span className="badge b-miss">brakuje {n}</span>;
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export function CheckRow(props: { checked?: boolean; disabled?: boolean; done?: boolean; onChange?: (checked: boolean) => void; label: string; sub?: string; qty?: string; children?: ReactNode }) {
  return (
    <label className={`check ${props.done ? "done" : ""}`}>
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={e => props.onChange?.(e.currentTarget.checked)} />
      <span className="lbl">{props.label}{props.sub && <span className="sub">{props.sub}</span>}</span>
      {props.qty && <span className="qty">{props.qty}</span>}
      {props.children}
    </label>
  );
}
