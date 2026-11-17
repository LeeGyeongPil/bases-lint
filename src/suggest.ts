/** Optimal string alignment distance (edit distance where swapping two neighbours costs 1). */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i]![0] = i;
  for (let j = 0; j < cols; j++) d[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[rows - 1]![cols - 1]!;
}

/**
 * Closest candidate to `word`, or undefined when nothing is close enough.
 * The allowed distance grows with the word length (1 for short words, 2 from 6 letters).
 */
export function suggest(word: string, candidates: Iterable<string>): string | undefined {
  const lower = word.toLowerCase();
  const limit = Math.max(1, Math.floor(word.length / 3));
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const c of candidates) {
    if (c === word) continue;
    const dist = Math.min(editDistance(word, c), c.toLowerCase() === lower ? 0 : Infinity);
    if (dist <= limit && dist < bestDistance) {
      best = c;
      bestDistance = dist;
    }
  }
  return best;
}
