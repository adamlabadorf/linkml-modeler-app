/** Parse a range edge ID: `range__{className}__{slotName}__{target}` */
export function parseRangeEdgeId(edgeId: string): { className: string; slotName: string; target: string } | null {
  if (!edgeId.startsWith('range__')) return null;
  const parts = edgeId.split('__');
  if (parts.length < 4) return null;
  return { className: parts[1], slotName: parts[2], target: parts.slice(3).join('__') };
}
