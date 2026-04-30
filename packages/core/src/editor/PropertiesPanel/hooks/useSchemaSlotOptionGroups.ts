import { useMemo } from 'react';
import { useAppStore } from '../../../store/index.js';
import type { OptionGroup } from '../../../ui/fields/index.js';

/** Returns grouped schema-level slot names from every schema in the project. */
export function useSchemaSlotOptionGroups(): OptionGroup[] {
  const allSchemas = useAppStore((s) => s.activeProject?.schemas ?? []);

  return useMemo(() => {
    const groups: OptionGroup[] = [];
    for (const sf of allSchemas) {
      const slotNames = Object.keys(sf.schema.slots ?? {}).sort();
      if (slotNames.length > 0) {
        groups.push({ label: sf.filePath.replace(/\.ya?ml$/, ''), options: slotNames });
      }
    }
    return groups;
  }, [allSchemas]);
}
