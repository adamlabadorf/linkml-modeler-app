import { useAppStore } from '../../store/index.js';
import { FieldRow } from '../../ui/fields/index.js';
import { EmptyPanel } from './EmptyPanel.js';
import { SectionHeader } from './internal.js';
import { SlotInlineEditor } from './SlotInlineEditor.js';
import { styles } from './styles.js';
import { parseRangeEdgeId } from './parseRangeEdgeId.js';
import { useRangeOptionGroups } from './hooks/useRangeOptionGroups.js';

const EDGE_TYPE_DESCRIPTIONS: Record<string, string> = {
  is_a: 'Inheritance — this class extends the target class.',
  mixin: 'Mixin — this class incorporates attributes from the target.',
  union_of: 'Union — the target is one of the constituent types.',
};

export function EdgePanel({ edgeId }: { edgeId: string }) {
  const edges = useAppStore((s) => s.edges);
  const edge = edges.find((e) => e.id === edgeId);
  const schema = useAppStore((s) => s.getActiveSchema());
  const updateAttribute = useAppStore((s) => s.updateAttribute);
  const autoAddImportForRange = useAppStore((s) => s.autoAddImportForRange);

  const rangeInfo = parseRangeEdgeId(edgeId);
  const schemaId = schema?.id ?? '';
  const schemaData = schema?.schema;

  const rangeOptionGroups = useRangeOptionGroups(schemaId);

  if (!edge) return <EmptyPanel message="Edge not found" />;

  // For range edges, resolve the slot and render an inline editor
  if (rangeInfo && schemaData) {
    const classDef = schemaData.classes[rangeInfo.className];
    const slot = classDef?.attributes[rangeInfo.slotName];

    if (slot) {
      return (
        <div>
          <SectionHeader title="Range Edge (editable)" />
          <div style={styles.editableBadge}>editable</div>
          <FieldRow label="Source">
            <span style={styles.readOnlyValue}>{rangeInfo.className}</span>
          </FieldRow>
          <FieldRow label="Target">
            <span style={styles.readOnlyValue}>{rangeInfo.target}</span>
          </FieldRow>
          <SectionHeader title="Slot Properties" />
          <SlotInlineEditor
            slot={slot}
            rangeOptionGroups={rangeOptionGroups}
            onUpdate={(partial) => {
              if (partial.range) {
                autoAddImportForRange(schemaId, partial.range);
              }
              updateAttribute(schemaId, rangeInfo.className, rangeInfo.slotName, partial);
            }}
            onDelete={() => {}}
          />
        </div>
      );
    }
  }

  // Non-range edges: read-only display with relationship description
  const edgeType = edge.type ?? edgeId.split('__')[0] ?? 'unknown';
  const description = EDGE_TYPE_DESCRIPTIONS[edgeType];

  return (
    <div>
      <SectionHeader title="Edge (read-only)" />
      <FieldRow label="Type">
        <span style={styles.readOnlyValue}>{edgeType}</span>
      </FieldRow>
      <FieldRow label="Source">
        <span style={styles.readOnlyValue}>{edge.source}</span>
      </FieldRow>
      <FieldRow label="Target">
        <span style={styles.readOnlyValue}>{edge.target}</span>
      </FieldRow>
      {edge.label && (
        <FieldRow label="Label">
          <span style={styles.readOnlyValue}>{String(edge.label)}</span>
        </FieldRow>
      )}
      {description && (
        <FieldRow label="Description">
          <span style={styles.edgeDescription}>{description}</span>
        </FieldRow>
      )}
    </div>
  );
}
