import { useMemo } from 'react';
import { useAppStore } from '../../../store/index.js';
import type { OptionGroup } from '../../../ui/fields/index.js';

/** Returns grouped class+enum options from every schema in the project. */
export function useRangeOptionGroups(_schemaId: string, excludeClassName?: string): OptionGroup[] {
  const allSchemas = useAppStore((s) => s.activeProject?.schemas ?? []);

  return useMemo(() => {
    const builtinTypes = ['string', 'integer', 'float', 'boolean', 'date', 'datetime', 'uri', 'uriorcurie'];
    const groups: OptionGroup[] = [
      { label: 'Built-in types', options: builtinTypes },
    ];

    for (const sf of allSchemas) {
      const label = sf.filePath.replace(/\.ya?ml$/, '');
      const classNames = Object.keys(sf.schema.classes).filter((n) => n !== excludeClassName).sort();
      const enumNames = Object.keys(sf.schema.enums).sort();
      const options = [...classNames, ...enumNames];
      if (options.length > 0) {
        groups.push({ label, options });
      }
    }

    return groups;
  }, [allSchemas, excludeClassName]);
}
