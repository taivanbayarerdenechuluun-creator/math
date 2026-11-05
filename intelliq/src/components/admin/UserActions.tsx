"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "./api";

export function UserActions({ id, role, roles, disabled, self }: { id: string; role: string; roles: string[]; disabled: boolean; self: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  async function update(body: { roleName?: string; disabled?: boolean }) {
    setErr("");
    const r = await adminApi("PUT", `users/${id}`, body);
    if (!r.ok) setErr(r.data.error ?? "Failed");
    else router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Role" defaultValue={role} disabled={self} onChange={(e) => void update({ roleName: e.target.value })} className="input !min-h-8 !w-auto !px-2 text-xs">{roles.map((r) => <option key={r}>{r}</option>)}</select>
      <button disabled={self} onClick={() => void update({ disabled: !disabled })} className="btn btn-ghost !min-h-8 !px-3 text-xs disabled:opacity-40">{disabled ? "Restore" : "Suspend"}</button>
      {err && <span role="alert" className="w-full text-xs text-rose-700 dark:text-rose-300">{err}</span>}
    </div>
  );
}
