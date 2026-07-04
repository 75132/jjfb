export function normalizeEnemyTokenExpression(rawInput: string): string {
  const raw = (rawInput ?? "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/，/g, ",").replace(/－/g, "-").replace(/\s+/g, "");
  const parts = cleaned.split(",").filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
        const key = `${a}-${b}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(key);
        }
      }
      continue;
    }
    if (/^[A-Za-z0-9_-]+$/.test(p)) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out.join(",");
}
