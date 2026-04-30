// fast-check arbitraries for LinkML schema property-based tests (PTS-79 §6.2)
import * as fc from 'fast-check';
import type {
  LinkMLSchema,
  ClassDefinition,
  SlotDefinition,
  EnumDefinition,
  PermissibleValue,
} from '../../model/index.js';

// ─── Character sets ───────────────────────────────────────────────────────────

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALPHANUMS = LOWER + UPPER + DIGITS;
const SNAKE_BODY = LOWER + DIGITS + '_';
const SAFE_TEXT = ALPHANUMS + ' ._-';

const arbLower = fc.constantFrom(...LOWER.split(''));
const arbUpper = fc.constantFrom(...UPPER.split(''));
const arbAlphanum = fc.constantFrom(...ALPHANUMS.split(''));
const arbSnakeBody = fc.constantFrom(...SNAKE_BODY.split(''));
const arbSafeChar = fc.constantFrom(...SAFE_TEXT.split(''));

// ─── Primitives ───────────────────────────────────────────────────────────────

/**
 * Snake_case or PascalCase identifier.
 * Matches what the parser accepts as class/slot/enum names.
 */
export const arbName: fc.Arbitrary<string> = fc.oneof(
  fc.tuple(arbLower, fc.array(arbSnakeBody, { minLength: 0, maxLength: 12 }))
    .map(([first, rest]) => first + rest.join('')),
  fc.tuple(arbUpper, fc.array(arbAlphanum, { minLength: 0, maxLength: 12 }))
    .map(([first, rest]) => first + rest.join('')),
);

/** Short printable ASCII text (safe for YAML block scalars). */
const arbShortText: fc.Arbitrary<string> = fc.string({
  unit: arbSafeChar,
  minLength: 1,
  maxLength: 50,
});

/**
 * CURIE of the form "prefix:LocalName".
 * prefix is all-lowercase; local part follows arbName.
 */
export const arbCURIE: fc.Arbitrary<string> = fc.tuple(
  fc.tuple(arbLower, fc.array(arbLower, { minLength: 0, maxLength: 6 }))
    .map(([f, r]) => f + r.join('')),
  arbName,
).map(([prefix, local]) => `${prefix}:${local}`);

// ─── LinkML model arbitraries ─────────────────────────────────────────────────

/**
 * PermissibleValue where text matches the containing dict key.
 * Caller passes the key; we generate optional description/meaning.
 */
function arbPermissibleValueFor(text: string): fc.Arbitrary<PermissibleValue> {
  return fc.record({
    description: fc.option(arbShortText, { nil: undefined }),
    meaning: fc.option(arbCURIE, { nil: undefined }),
  }).map(body => {
    const pv: PermissibleValue = { text };
    if (body.description !== undefined) pv.description = body.description;
    if (body.meaning !== undefined) pv.meaning = body.meaning;
    return pv;
  });
}

/**
 * EnumDefinition with 1–5 permissible values.
 * Guarantees pv.text === key in permissibleValues (required for round-trip).
 */
export const arbEnumDefinition: fc.Arbitrary<EnumDefinition> = fc.record({
  name: arbName,
  description: fc.option(arbShortText, { nil: undefined }),
  pvDict: fc.dictionary(arbName, fc.constant(null), { minKeys: 1, maxKeys: 5 }),
}).chain(({ name, description, pvDict }) => {
  const keys = Object.keys(pvDict);
  // Generate a PermissibleValue for each key in parallel via array.
  return fc.array(
    fc.record({
      description: fc.option(arbShortText, { nil: undefined }),
      meaning: fc.option(arbCURIE, { nil: undefined }),
    }),
    { minLength: keys.length, maxLength: keys.length },
  ).map(bodies => {
    const permissibleValues: Record<string, PermissibleValue> = {};
    keys.forEach((key, i) => {
      const pv: PermissibleValue = { text: key };
      if (bodies[i].description !== undefined) pv.description = bodies[i].description as string;
      if (bodies[i].meaning !== undefined) pv.meaning = bodies[i].meaning as string;
      permissibleValues[key] = pv;
    });
    const result: EnumDefinition = { name, permissibleValues };
    if (description !== undefined) result.description = description;
    return result;
  });
});

/**
 * SlotDefinition in canonical parsed form (no undefined keys, name always set).
 * Occasionally carries an `extras` payload to exercise the extras round-trip.
 */
export const arbSlotDefinition: fc.Arbitrary<SlotDefinition> = fc.record({
  name: arbName,
  description: fc.option(arbShortText, { nil: undefined }),
  range: fc.option(arbName, { nil: undefined }),
  required: fc.option(fc.boolean(), { nil: undefined }),
  recommended: fc.option(fc.boolean(), { nil: undefined }),
  multivalued: fc.option(fc.boolean(), { nil: undefined }),
  identifier: fc.option(fc.boolean(), { nil: undefined }),
  inlined: fc.option(fc.boolean(), { nil: undefined }),
  symmetric: fc.option(fc.boolean(), { nil: undefined }),
  relatedMappings: fc.option(
    fc.array(arbCURIE, { minLength: 1, maxLength: 3 }),
    { nil: undefined },
  ),
  extras: fc.option(
    fc.constant({ x_test_extra: 'round_trip_value' } as Record<string, unknown>),
    { nil: undefined },
  ),
}).map(raw => {
  const slot: SlotDefinition = { name: raw.name };
  if (raw.description !== undefined) slot.description = raw.description;
  if (raw.range !== undefined) slot.range = raw.range;
  if (raw.required !== undefined) slot.required = raw.required;
  if (raw.recommended !== undefined) slot.recommended = raw.recommended;
  if (raw.multivalued !== undefined) slot.multivalued = raw.multivalued;
  if (raw.identifier !== undefined) slot.identifier = raw.identifier;
  if (raw.inlined !== undefined) slot.inlined = raw.inlined;
  if (raw.symmetric !== undefined) slot.symmetric = raw.symmetric;
  if (raw.relatedMappings !== undefined) slot.relatedMappings = raw.relatedMappings;
  if (raw.extras !== undefined) slot.extras = raw.extras;
  return slot;
});

/**
 * ClassDefinition in canonical parsed form.
 * mixins/slots/attributes/slotUsage are always present (matching parser defaults).
 * Optional fields are absent rather than undefined.
 * Inheritance depth is bounded: isA references are left as opaque strings (no
 * graph closure needed for the round-trip property).
 */
export const arbClassDefinition: fc.Arbitrary<ClassDefinition> = fc.record({
  name: arbName,
  description: fc.option(arbShortText, { nil: undefined }),
  isA: fc.option(arbName, { nil: undefined }),
  mixins: fc.array(arbName, { minLength: 0, maxLength: 3 }),
  abstract: fc.option(fc.boolean(), { nil: undefined }),
  mixin: fc.option(fc.boolean(), { nil: undefined }),
  treeRoot: fc.option(fc.boolean(), { nil: undefined }),
  slots: fc.array(arbName, { minLength: 0, maxLength: 3 }),
  // Attributes: 0–3 inline SlotDefinitions
  attributes: fc.dictionary(arbName, arbSlotDefinition, { minKeys: 0, maxKeys: 3 }),
  extras: fc.option(
    fc.constant({ x_test_extra: 'class_round_trip' } as Record<string, unknown>),
    { nil: undefined },
  ),
}).map(raw => {
  // Fix attribute names to match their dict keys
  const attributes: Record<string, SlotDefinition> = {};
  for (const [key, slot] of Object.entries(raw.attributes)) {
    attributes[key] = { ...slot, name: key };
  }

  const cls: ClassDefinition = {
    name: raw.name,
    mixins: raw.mixins,
    slots: raw.slots,
    attributes,
    slotUsage: {},
  };
  if (raw.description !== undefined) cls.description = raw.description;
  if (raw.isA !== undefined) cls.isA = raw.isA;
  if (raw.abstract !== undefined) cls.abstract = raw.abstract;
  if (raw.mixin !== undefined) cls.mixin = raw.mixin;
  if (raw.treeRoot !== undefined) cls.treeRoot = raw.treeRoot;
  if (raw.extras !== undefined) cls.extras = raw.extras;
  return cls;
});

/**
 * Complete LinkMLSchema biased toward 1–10 classes.
 * All name/key invariants are enforced after generation.
 */
export const arbLinkMLSchema: fc.Arbitrary<LinkMLSchema> = fc.record({
  id: arbName.map(n => `https://example.org/${n}`),
  name: arbName,
  title: fc.option(arbShortText, { nil: undefined }),
  description: fc.option(arbShortText, { nil: undefined }),
  prefixes: fc.constant({ linkml: 'https://w3id.org/linkml/' } as Record<string, string>),
  defaultPrefix: arbName,
  defaultRange: fc.option(fc.constant('string'), { nil: undefined }),
  imports: fc.array(fc.constant('linkml:types'), { minLength: 0, maxLength: 1 }),
  subsets: fc.constant({} as Record<string, never>),
  types: fc.constant({} as Record<string, never>),
  slots: fc.constant({} as Record<string, never>),
  enums: fc.dictionary(arbName, arbEnumDefinition, { minKeys: 0, maxKeys: 3 }),
  classes: fc.dictionary(arbName, arbClassDefinition, { minKeys: 1, maxKeys: 10 }),
}).map(raw => {
  // Fix enum names to match dict keys
  const enums: Record<string, EnumDefinition> = {};
  for (const [key, enm] of Object.entries(raw.enums)) {
    enums[key] = { ...enm, name: key };
  }

  // Fix class names to match dict keys
  const classes: Record<string, ClassDefinition> = {};
  for (const [key, cls] of Object.entries(raw.classes)) {
    classes[key] = { ...cls, name: key };
  }

  const schema: LinkMLSchema = {
    id: raw.id,
    name: raw.name,
    prefixes: raw.prefixes,
    defaultPrefix: raw.defaultPrefix,
    imports: raw.imports,
    subsets: raw.subsets as Record<string, never>,
    types: raw.types as Record<string, never>,
    slots: raw.slots as Record<string, never>,
    enums,
    classes,
  };
  if (raw.title !== undefined) schema.title = raw.title;
  if (raw.description !== undefined) schema.description = raw.description;
  if (raw.defaultRange !== undefined) schema.defaultRange = raw.defaultRange;
  return schema;
});
