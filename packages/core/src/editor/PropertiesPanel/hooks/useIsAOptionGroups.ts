import { useMemo } from 'react';
import { useAppStore } from '../../../store/index.js';
import type { OptionGroup } from '../../../ui/fields/index.js';

/** Returns grouped class-only options from every schema in the project. */
export function useIsAOptionGroups(excludeClassName?: string): OptionGroup[] {
  const allSchemas = useAppStore((s) => s.activeProject?.schemas ?? []);

  return useMemo(() => {
    const groups: OptionGroup[] = [];

    for (const sf of allSchemas) {
      const label = sf.filePath.replace(/\.ya?ml$/, '');
      const classNames = Object.keys(sf.schema.classes).filter((n) => n !== excludeClassName).sort();
      if (classNames.length > 0) {
        groups.push({ label, options: classNames });
      }
    }

    return groups;
  }, [allSchemas, excludeClassName]);
}
