"use client";

// 記録を削除するボタン。押すと確認 → 削除 → 記録一覧へ戻る。
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    if (!window.confirm("この記録を削除しますか？（元に戻せません）")) return;
    setError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/records");
      router.refresh();
    } catch {
      setDeleting(false);
      setError("削除に失敗しました");
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="rounded-full border border-red-500/40 px-5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
      >
        {deleting ? "削除中…" : "この記録を削除"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
