/**
 * The ลำดับที่ column of a ปร.4 sheet, derived rather than stored.
 *
 * A real sheet numbers its headings 1, then 1.1, 1.2, 1.3 beneath it. That number is a position,
 * not an identity: delete 1.2 and what was 1.3 becomes 1.2 on the very next printout. Storing it
 * would mean every deletion has to renumber rows that were not touched, and the first time that
 * fails the paper and the database disagree about which line is which. Deriving it costs a walk
 * and can never drift.
 */

export const MAX_GROUP_DEPTH = 2;
export const GROUP_TITLE_MIN = 2;
export const GROUP_TITLE_MAX = 160;

export type OutlineGroupInput = {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
};

export type OutlineNode = {
  id: string;
  parentId: string | null;
  title: string;
  /** The dotted number as it prints: "1", "1.2". */
  number: string;
  /** 1 for a top-level heading, 2 for one nested inside it. */
  depth: number;
};

/** Stable order: by sortOrder, then by id so equal sort values never shuffle between reads. */
function byPosition(left: OutlineGroupInput, right: OutlineGroupInput): number {
  return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);
}

/**
 * Numbers the headings in reading order.
 *
 * Groups whose parent is missing from the input are treated as top level rather than dropped: a
 * heading a reader can see on screen must appear on the sheet, even when the data is odd. A
 * parent chain that loops is broken the same way, so a bad row cannot hang the render.
 */
export function buildOutline(groups: readonly OutlineGroupInput[]): OutlineNode[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const childrenOf = new Map<string | null, OutlineGroupInput[]>();

  for (const group of groups) {
    const parentId = group.parentId !== null && byId.has(group.parentId) && group.parentId !== group.id
      ? group.parentId
      : null;
    const siblings = childrenOf.get(parentId);
    if (siblings) siblings.push(group);
    else childrenOf.set(parentId, [group]);
  }

  const nodes: OutlineNode[] = [];
  const visited = new Set<string>();

  function walk(parentId: string | null, prefix: string, depth: number) {
    if (depth > MAX_GROUP_DEPTH) return;
    const siblings = [...(childrenOf.get(parentId) ?? [])].sort(byPosition);
    siblings.forEach((group, index) => {
      if (visited.has(group.id)) return;
      visited.add(group.id);
      const number = prefix === "" ? String(index + 1) : `${prefix}.${index + 1}`;
      nodes.push({ id: group.id, parentId, title: group.title, number, depth });
      walk(group.id, number, depth + 1);
    });
  }

  walk(null, "", 1);
  return nodes;
}

/** The number a group prints, or null when it is not in this outline. */
export function outlineNumber(nodes: readonly OutlineNode[], groupId: string | null): string | null {
  if (groupId === null) return null;
  return nodes.find((node) => node.id === groupId)?.number ?? null;
}
