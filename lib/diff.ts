export type DiffOp = { type: 'same' | 'add' | 'del'; text: string };

/** Построчный diff по общему префиксу/суффиксу. Быстрый и достаточный,
 *  чтобы автор увидел, что именно изменится в опубликованной главе. */
export function diffLines(before: string, after: string, maxLines = 2000): DiffOp[] {
  const A = before.split('\n');
  const B = after.split('\n');
  if (A.length > maxLines || B.length > maxLines) {
    return [{ type: 'del', text: '…слишком большой фрагмент для построчного сравнения…' }];
  }
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start += 1;
  let endA = A.length - 1;
  let endB = B.length - 1;
  while (endA >= start && endB >= start && A[endA] === B[endB]) { endA -= 1; endB -= 1; }

  const ops: DiffOp[] = [];
  for (let i = 0; i < start; i += 1) ops.push({ type: 'same', text: A[i] });
  for (let i = start; i <= endA; i += 1) ops.push({ type: 'del', text: A[i] });
  for (let i = start; i <= endB; i += 1) ops.push({ type: 'add', text: B[i] });
  for (let i = endA + 1; i < A.length; i += 1) ops.push({ type: 'same', text: A[i] });
  return ops;
}

export function diffStats(ops: DiffOp[]): { added: number; removed: number } {
  return ops.reduce((acc, op) => {
    if (op.type === 'add') acc.added += 1;
    if (op.type === 'del') acc.removed += 1;
    return acc;
  }, { added: 0, removed: 0 });
}
