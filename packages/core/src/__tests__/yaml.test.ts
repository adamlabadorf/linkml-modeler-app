// YAML Round-Trip Engine Tests

import { describe, it, expect } from 'vitest';
import { parseYaml, serializeYaml, validateSchema } from '../io/yaml.js';
import type { LinkMLSchema } from '../model/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PERSON_INFO_YAML = `
id: https://example.org/personinfo
name: personinfo
title: Person Information Schema
description: >-
  A schema for basic person information
prefixes:
  linkml: https://w3id.org/linkml/
  personinfo: https://example.org/personinfo/
  schema: http://schema.org/
default_prefix: personinfo
default_range: string
imports:
  - linkml:types

subsets:
  BasicSubset:
    description: A subset of basic fields

types:
  UriOrCurie:
    uri: xsd:anyURI
    description: A URI or CURIE

enums:
  GenderType:
    permissible_values:
      male:
        description: Male gender
        meaning: schema:Male
      female:
        description: Female gender
        meaning: schema:Female
      nonbinary_person:
        description: A person who does not identify as strictly male or female

classes:
  NamedThing:
    description: A generic grouping for any identifiable entity
    slots:
      - id
      - name
      - description
    class_uri: schema:Thing

  Person:
    is_a: NamedThing
    description: A person (human being)
    mixins:
      - HasAliases
    tree_root: true
    attributes:
      primary_email:
        description: The email address of a person
        range: string
        required: false
      age_in_years:
        description: Number of years since birth
        range: integer
        multivalued: false

  HasAliases:
    mixin: true
    description: A mixin applied to any class that can have aliases/alternative names
    attributes:
      aliases:
        multivalued: true
        range: string
`;

const EMPTY_SCHEMA_YAML = `
id: https://example.org/empty
name: empty
prefixes:
  linkml: https://w3id.org/linkml/
default_prefix: empty
imports:
  - linkml:types
`;

const IMPORTS_ONLY_YAML = `
id: https://example.org/imports-only
name: imports_only
prefixes:
  linkml: https://w3id.org/linkml/
default_prefix: imports_only
imports:
  - linkml:types
  - linkml:annotations
`;

const ENUM_ONLY_YAML = `
id: https://example.org/enum-only
name: enum_only
prefixes:
  linkml: https://w3id.org/linkml/
default_prefix: enum_only
imports:
  - linkml:types
enums:
  StatusType:
    description: Possible status values
    permissible_values:
      active: null
      inactive: null
      pending:
        description: Awaiting processing
`;

const UNKNOWN_KEYS_YAML = `
id: https://example.org/unknown
name: unknown_keys
prefixes:
  linkml: https://w3id.org/linkml/
default_prefix: unknown_keys
imports:
  - linkml:types
some_future_key: future_value
classes:
  MyClass:
    description: A class
    future_class_key: some_value
`;

// ─── Round-Trip Helper ────────────────────────────────────────────────────────

function roundTrip(yaml: string): LinkMLSchema {
  return parseYaml(serializeYaml(parseYaml(yaml)));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseYaml', () => {
  it('parses basic schema fields', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.id).toBe('https://example.org/personinfo');
    expect(schema.name).toBe('personinfo');
    expect(schema.title).toBe('Person Information Schema');
    expect(schema.defaultPrefix).toBe('personinfo');
    expect(schema.defaultRange).toBe('string');
  });

  it('parses prefixes as Record<string, string>', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.prefixes['linkml']).toBe('https://w3id.org/linkml/');
    expect(schema.prefixes['personinfo']).toBe('https://example.org/personinfo/');
    expect(schema.prefixes['schema']).toBe('http://schema.org/');
  });

  it('parses imports', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.imports).toContain('linkml:types');
  });

  it('parses subsets', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.subsets['BasicSubset']).toBeDefined();
    expect(schema.subsets['BasicSubset'].description).toBe('A subset of basic fields');
  });

  it('parses types', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.types['UriOrCurie']).toBeDefined();
    expect(schema.types['UriOrCurie'].uri).toBe('xsd:anyURI');
    expect(schema.types['UriOrCurie'].description).toBe('A URI or CURIE');
  });

  it('parses enums with permissible values', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    const gender = schema.enums['GenderType'];
    expect(gender).toBeDefined();
    expect(gender.permissibleValues['male'].meaning).toBe('schema:Male');
    expect(gender.permissibleValues['male'].description).toBe('Male gender');
    expect(gender.permissibleValues['nonbinary_person'].text).toBe('nonbinary_person');
  });

  it('parses classes', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    const named = schema.classes['NamedThing'];
    expect(named).toBeDefined();
    expect(named.description).toBe('A generic grouping for any identifiable entity');
    expect(named.slots).toContain('id');
    expect(named.uriAnnotation).toBe('schema:Thing');
  });

  it('parses class inheritance (is_a)', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.classes['Person'].isA).toBe('NamedThing');
  });

  it('parses class mixins', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.classes['Person'].mixins).toContain('HasAliases');
  });

  it('parses mixin flag', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.classes['HasAliases'].mixin).toBe(true);
  });

  it('parses tree_root flag', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    expect(schema.classes['Person'].treeRoot).toBe(true);
  });

  it('parses inline attributes', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    const person = schema.classes['Person'];
    expect(person.attributes['primary_email']).toBeDefined();
    expect(person.attributes['primary_email'].range).toBe('string');
    expect(person.attributes['age_in_years'].multivalued).toBe(false);
  });

  it('parses empty schema', () => {
    const schema = parseYaml(EMPTY_SCHEMA_YAML);
    expect(schema.id).toBe('https://example.org/empty');
    expect(Object.keys(schema.classes)).toHaveLength(0);
    expect(Object.keys(schema.enums)).toHaveLength(0);
  });

  it('parses imports-only schema', () => {
    const schema = parseYaml(IMPORTS_ONLY_YAML);
    expect(schema.imports).toHaveLength(2);
    expect(schema.imports).toContain('linkml:annotations');
  });

  it('parses enum-only schema', () => {
    const schema = parseYaml(ENUM_ONLY_YAML);
    expect(Object.keys(schema.classes)).toHaveLength(0);
    expect(schema.enums['StatusType']).toBeDefined();
  });

  it('preserves unknown keys in extras', () => {
    const schema = parseYaml(UNKNOWN_KEYS_YAML);
    expect(schema.extras?.['some_future_key']).toBe('future_value');
    expect(schema.classes['MyClass'].extras?.['future_class_key']).toBe('some_value');
  });

  it('throws on invalid YAML', () => {
    expect(() => parseYaml('{')).toThrow();
  });

  it('throws on non-object YAML', () => {
    expect(() => parseYaml('- just a list')).toThrow(/expected a mapping/i);
  });
});

describe('serializeYaml', () => {
  it('serializes id and name', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    const output = serializeYaml(schema);
    expect(output).toContain('id: https://example.org/personinfo');
    expect(output).toContain('name: personinfo');
  });

  it('serializes prefixes', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    const output = serializeYaml(schema);
    expect(output).toContain('linkml: https://w3id.org/linkml/');
  });

  it('omits undefined optional fields', () => {
    const schema = parseYaml(EMPTY_SCHEMA_YAML);
    const output = serializeYaml(schema);
    expect(output).not.toContain('classes:');
    expect(output).not.toContain('enums:');
    expect(output).not.toContain('subsets:');
  });

  it('serializes enums', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    const output = serializeYaml(schema);
    expect(output).toContain('GenderType:');
    expect(output).toContain('male:');
  });

  it('serializes class attributes', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    const output = serializeYaml(schema);
    expect(output).toContain('primary_email:');
    expect(output).toContain('age_in_years:');
  });

  it('restores extras in output', () => {
    const schema = parseYaml(UNKNOWN_KEYS_YAML);
    const output = serializeYaml(schema);
    expect(output).toContain('some_future_key: future_value');
    expect(output).toContain('future_class_key: some_value');
  });
});

describe('round-trip fidelity', () => {
  it('parse(serialize(parse(x))) === parse(x) for personinfo', () => {
    const once = parseYaml(PERSON_INFO_YAML);
    const twice = roundTrip(PERSON_INFO_YAML);
    expect(twice).toEqual(once);
  });

  it('round-trips empty schema', () => {
    const once = parseYaml(EMPTY_SCHEMA_YAML);
    const twice = roundTrip(EMPTY_SCHEMA_YAML);
    expect(twice).toEqual(once);
  });

  it('round-trips imports-only schema', () => {
    const once = parseYaml(IMPORTS_ONLY_YAML);
    const twice = roundTrip(IMPORTS_ONLY_YAML);
    expect(twice).toEqual(once);
  });

  it('round-trips enum-only schema', () => {
    const once = parseYaml(ENUM_ONLY_YAML);
    const twice = roundTrip(ENUM_ONLY_YAML);
    expect(twice).toEqual(once);
  });

  it('extras fields survive round-trip', () => {
    const once = parseYaml(UNKNOWN_KEYS_YAML);
    const twice = roundTrip(UNKNOWN_KEYS_YAML);
    expect(twice.extras?.['some_future_key']).toBe('future_value');
    expect(twice.classes['MyClass'].extras?.['future_class_key']).toBe('some_value');
  });

  it('round-trips complex schema with all constructs', () => {
    const complex = `
id: https://example.org/complex
name: complex
prefixes:
  linkml: https://w3id.org/linkml/
  ex: https://example.org/
default_prefix: ex
default_range: string
imports:
  - linkml:types
subsets:
  CoreSubset:
    description: Core fields subset
types:
  MyString:
    typeof: string
    description: A custom string
enums:
  StatusEnum:
    description: Status values
    permissible_values:
      active:
        meaning: ex:Active
      inactive: null
classes:
  BaseClass:
    description: Base
    abstract: true
    slots:
      - id
  ChildClass:
    is_a: BaseClass
    description: A child class
    mixins:
      - SomeMixin
    attributes:
      name:
        range: string
        required: true
      status:
        range: StatusEnum
        multivalued: false
    slot_usage:
      id:
        required: true
        identifier: true
  SomeMixin:
    mixin: true
    description: A mixin
    attributes:
      tags:
        multivalued: true
        range: string
`;
    const once = parseYaml(complex);
    const twice = roundTrip(complex);
    expect(twice).toEqual(once);
  });
});

describe('validateSchema', () => {
  it('returns no errors for a valid schema', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    const errors = validateSchema(schema);
    const errorLevel = errors.filter(e => e.severity === 'error');
    expect(errorLevel).toHaveLength(0);
  });

  it('returns error for missing id', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    schema.id = '';
    const errors = validateSchema(schema);
    expect(errors.some(e => e.path === 'id' && e.severity === 'error')).toBe(true);
  });

  it('returns error for missing name', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    schema.name = '';
    const errors = validateSchema(schema);
    expect(errors.some(e => e.path === 'name' && e.severity === 'error')).toBe(true);
  });

  it('warns when is_a references a non-existent class', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    schema.classes['Person'].isA = 'NonExistentClass';
    const errors = validateSchema(schema);
    expect(errors.some(e => e.path.includes('is_a') && e.severity === 'warning')).toBe(true);
  });

  it('returns warning for missing default_prefix', () => {
    const schema = parseYaml(PERSON_INFO_YAML);
    schema.defaultPrefix = '';
    const errors = validateSchema(schema);
    expect(errors.some(e => e.path === 'default_prefix' && e.severity === 'warning')).toBe(true);
  });
});

// ─── Kitchen-sink coverage: rarely-exercised branches ─────────────────────────

const KITCHEN_SINK_YAML = `
id: https://example.org/kitchen-sink
name: kitchen_sink
title: Kitchen Sink Schema
description: Exercises all optional fields for coverage
version: '1.0'
license: Apache-2.0
prefixes:
  linkml: https://w3id.org/linkml/
  ex: https://example.org/
default_prefix: ex
default_range: string
imports:
  - linkml:types

subsets:
  CoreSubset:
    description: Core fields subset

types:
  MyString:
    uri: xsd:string
    description: Custom string type
    typeof: string

slots:
  subject:
    description: The subject slot
    range: string
    required: true
    recommended: true
    multivalued: false
    identifier: true
    key: true
    inlined: false
    inlined_as_list: false
    domain: BaseClass
    domain_of:
      - BaseClass
    subset_of:
      - CoreSubset
    ifabsent: string(default)
    alias: subject_alias
    slot_uri: ex:subject
    mappings:
      - ex:m1
    exact_mappings:
      - ex:em1
    close_mappings:
      - ex:cm1
    broad_mappings:
      - ex:bm1
    narrow_mappings:
      - ex:nm1

enums:
  OntologyTerm:
    description: Ontology terms
    code_set: https://example.org/codes
    subset_of:
      - CoreSubset
    reachable_from:
      source_ontology: obo:HP
      source_nodes:
        - HP:0000001
      relationship: rdfs:subClassOf
    permissible_values:
      term1:
        description: First term
        meaning: ex:Term1

classes:
  BaseClass:
    description: Base class with all optional fields
    abstract: true
    slots:
      - subject
    rules:
      - title: Status rule
        description: When active, name is required
        bidirectional: true
        open_world: false
        deactivated: false
        rank: 1
        preconditions:
          slot_conditions:
            subject:
              equals_string: active
              equals_number: 42
              pattern: '^active$'
              minimum_value: 0
              maximum_value: 100
              required: true
              recommended: true
              multivalued: false
              minimum_cardinality: 1
              maximum_cardinality: 5
              range: string
              value_presence: PRESENT
              equals_string_in:
                - active
                - inactive
              any_of:
                - equals_string: x
              all_of:
                - required: true
              exactly_one_of:
                - equals_string: y
              none_of:
                - equals_string: z
              has_member:
                range: string
              all_members:
                required: true
        postconditions:
          slot_conditions:
            subject:
              required: true
        elseconditions:
          is_a: BaseClass
          slot_conditions:
            subject:
              required: false
`;

describe('kitchen-sink: rarely-exercised yaml branches', () => {
  it('parses all optional slot fields', () => {
    const schema = parseYaml(KITCHEN_SINK_YAML);
    const slot = schema.slots['subject'];
    expect(slot.required).toBe(true);
    expect(slot.recommended).toBe(true);
    expect(slot.keyField).toBe(true);
    expect(slot.inlined).toBe(false);
    expect(slot.inlinedAsList).toBe(false);
    expect(slot.domain).toBe('BaseClass');
    expect(slot.domainOf).toEqual(['BaseClass']);
    expect(slot.subsetOf).toEqual(['CoreSubset']);
    expect(slot.ifAbsent).toBe('string(default)');
    expect(slot.alias).toBe('subject_alias');
    expect(slot.slotUri).toBe('ex:subject');
    expect(slot.mappings).toEqual(['ex:m1']);
    expect(slot.exactMappings).toEqual(['ex:em1']);
    expect(slot.closeMappings).toEqual(['ex:cm1']);
    expect(slot.broadMappings).toEqual(['ex:bm1']);
    expect(slot.narrowMappings).toEqual(['ex:nm1']);
  });

  it('parses enum reachable_from with source_nodes and relationship', () => {
    const schema = parseYaml(KITCHEN_SINK_YAML);
    const enm = schema.enums['OntologyTerm'];
    expect(enm.codeSet).toBe('https://example.org/codes');
    expect(enm.subsetOf).toEqual(['CoreSubset']);
    expect(enm.reachableFrom?.sourceOntology).toBe('obo:HP');
    expect(enm.reachableFrom?.sourceNodes).toEqual(['HP:0000001']);
    expect(enm.reachableFrom?.relationship).toBe('rdfs:subClassOf');
  });

  it('parses ClassRule with all flags and elseconditions', () => {
    const schema = parseYaml(KITCHEN_SINK_YAML);
    const rule = schema.classes['BaseClass'].rules![0];
    expect(rule.bidirectional).toBe(true);
    expect(rule.openWorld).toBe(false);
    expect(rule.deactivated).toBe(false);
    expect(rule.rank).toBe(1);
    expect(rule.elseconditions?.isA).toBe('BaseClass');
  });

  it('parses SlotCondition with all fields', () => {
    const schema = parseYaml(KITCHEN_SINK_YAML);
    const rule = schema.classes['BaseClass'].rules![0];
    const sc = rule.preconditions!.slotConditions!['subject'];
    expect(sc.equalsString).toBe('active');
    expect(sc.equalsNumber).toBe(42);
    expect(sc.pattern).toBe('^active$');
    expect(sc.minimumValue).toBe(0);
    expect(sc.maximumValue).toBe(100);
    expect(sc.required).toBe(true);
    expect(sc.recommended).toBe(true);
    expect(sc.multivalued).toBe(false);
    expect(sc.minimumCardinality).toBe(1);
    expect(sc.maximumCardinality).toBe(5);
    expect(sc.range).toBe('string');
    expect(sc.valuePresence).toBe('PRESENT');
    expect(sc.equalsStringIn).toEqual(['active', 'inactive']);
    expect(sc.anyOf).toHaveLength(1);
    expect(sc.allOf).toHaveLength(1);
    expect(sc.exactlyOneOf).toHaveLength(1);
    expect(sc.noneOf).toHaveLength(1);
    expect(sc.hasMember?.range).toBe('string');
    expect(sc.allMembers?.required).toBe(true);
  });

  it('round-trips the kitchen-sink schema', () => {
    const once = parseYaml(KITCHEN_SINK_YAML);
    const twice = roundTrip(KITCHEN_SINK_YAML);
    expect(twice).toEqual(once);
  });

  it('parses prefixes in array format (prefix_prefix / prefix_reference)', () => {
    const arrayPrefixYaml = `
id: https://example.org/array-prefix
name: array_prefix
prefixes:
  - prefix_prefix: linkml
    prefix_reference: https://w3id.org/linkml/
  - prefix_prefix: ex
    prefix_reference: https://example.org/
default_prefix: ex
`;
    const schema = parseYaml(arrayPrefixYaml);
    expect(schema.prefixes['linkml']).toBe('https://w3id.org/linkml/');
    expect(schema.prefixes['ex']).toBe('https://example.org/');
  });
});

// ─── T1 #5 — TypeDefinition.base and repr round-trip ─────────────────────────

describe('TypeDefinition.base and repr (T1 #5)', () => {
  const SCHEMA_WITH_TYPE_BASE_REPR = `
id: https://example.org/types-test
name: types_test
prefixes:
  linkml: https://w3id.org/linkml/
  xsd: http://www.w3.org/2001/XMLSchema#
default_prefix: types_test
types:
  StrRepr:
    typeof: integer
    base: int
    repr: str
    description: Integer with custom python repr
  StrOnly:
    typeof: string
    base: str
`;

  it('parses base and repr from TypeDefinition', () => {
    const schema = parseYaml(SCHEMA_WITH_TYPE_BASE_REPR);
    expect(schema.types['StrRepr'].base).toBe('int');
    expect(schema.types['StrRepr'].repr).toBe('str');
    expect(schema.types['StrOnly'].base).toBe('str');
    expect(schema.types['StrOnly'].repr).toBeUndefined();
  });

  it('round-trips base and repr without data loss', () => {
    const once = parseYaml(SCHEMA_WITH_TYPE_BASE_REPR);
    const twice = parseYaml(serializeYaml(once));
    expect(twice.types['StrRepr'].base).toBe('int');
    expect(twice.types['StrRepr'].repr).toBe('str');
    expect(twice.types['StrOnly'].base).toBe('str');
  });

  it('emitted YAML contains base and repr keys', () => {
    const schema = parseYaml(SCHEMA_WITH_TYPE_BASE_REPR);
    const yaml = serializeYaml(schema);
    expect(yaml).toContain('base: int');
    expect(yaml).toContain('repr: str');
  });
});

// ─── T1 #6 — Schema-level slot is_a and mixins round-trip ────────────────────

describe('Schema-level slot is_a and mixins (T1 #6)', () => {
  const SCHEMA_WITH_SLOT_INHERITANCE = `
id: https://example.org/slot-inheritance
name: slot_inheritance
prefixes:
  linkml: https://w3id.org/linkml/
default_prefix: slot_inheritance
slots:
  base_slot:
    range: string
    description: The base slot
  child_slot:
    is_a: base_slot
    range: string
    description: Inherits from base_slot
  mixin_slot:
    mixin: true
  combined_slot:
    is_a: base_slot
    mixins:
      - mixin_slot
    range: string
`;

  it('parses is_a and mixins from schema-level slots', () => {
    const schema = parseYaml(SCHEMA_WITH_SLOT_INHERITANCE);
    expect(schema.slots['child_slot'].isA).toBe('base_slot');
    expect(schema.slots['combined_slot'].isA).toBe('base_slot');
    expect(schema.slots['combined_slot'].mixins).toEqual(['mixin_slot']);
    expect(schema.slots['base_slot'].isA).toBeUndefined();
  });

  it('round-trips slot is_a and mixins without data loss', () => {
    const once = parseYaml(SCHEMA_WITH_SLOT_INHERITANCE);
    const twice = parseYaml(serializeYaml(once));
    expect(twice.slots['child_slot'].isA).toBe('base_slot');
    expect(twice.slots['combined_slot'].isA).toBe('base_slot');
    expect(twice.slots['combined_slot'].mixins).toEqual(['mixin_slot']);
  });

  it('emitted YAML contains is_a and mixins for schema-level slots', () => {
    const schema = parseYaml(SCHEMA_WITH_SLOT_INHERITANCE);
    const yaml = serializeYaml(schema);
    expect(yaml).toContain('is_a: base_slot');
    expect(yaml).toContain('mixins:');
  });
});
