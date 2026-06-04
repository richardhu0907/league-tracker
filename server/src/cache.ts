const store = new Map<string, { data: unknown; ts: number }>();

export async function cached<T>(key: string, fn: () => Promise<T>, ttlMs: number): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data as T;
  const data = await fn();
  store.set(key, { data, ts: Date.now() });
  return data;
}
