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
