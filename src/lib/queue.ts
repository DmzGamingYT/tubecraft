/** Opérations pures sur la file « Lire ensuite » (identifiants de vidéos). */

export function addToQueue(queue: string[], id: string): string[] {
  if (!id || queue.includes(id)) return queue;
  return [...queue, id];
}

export function removeFromQueue(queue: string[], id: string): string[] {
  return queue.includes(id) ? queue.filter((item) => item !== id) : queue;
}

/** Déplace une vidéo de `delta` rangs (-1 = plus tôt, +1 = plus tard). */
export function moveInQueue(queue: string[], id: string, delta: number): string[] {
  const from = queue.indexOf(id);
  if (from < 0 || !Number.isInteger(delta) || delta === 0) return queue;
  const to = Math.min(queue.length - 1, Math.max(0, from + delta));
  if (to === from) return queue;
  const next = [...queue];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Alterne l'appartenance à la file, en ajoutant toujours en fin de file. */
export function toggleInQueue(queue: string[], id: string): string[] {
  return queue.includes(id) ? removeFromQueue(queue, id) : addToQueue(queue, id);
}

/** Garde l'ordre et retire les identifiants invalides ou dupliqués. */
export function normalizeQueue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}
