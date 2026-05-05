import type { PackagingItem } from "@/lib/db";

export type PackagingItemGroup = {
  groupName: string;
  items: PackagingItem[];
};

export function groupPackagingMasterItems(items: PackagingItem[]): PackagingItemGroup[] {
  const groups = new Map<string, PackagingItem[]>();

  for (const item of items) {
    const dashIndex = item.code.indexOf("-");
    const groupName = dashIndex > 0 ? item.code.slice(0, dashIndex) : "Generic";
    const existing = groups.get(groupName) ?? [];
    existing.push(item);
    groups.set(groupName, existing);
  }

  const orderedGroupNames = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Generic") return -1;
    if (b === "Generic") return 1;
    return a.localeCompare(b);
  });

  return orderedGroupNames.map((groupName) => ({
    groupName,
    items: (groups.get(groupName) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
  }));
}
