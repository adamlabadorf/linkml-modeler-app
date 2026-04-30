// Round-trip tests for the LinkML YAML I/O engine (PTS-79)
// Suite 1: Golden-file byte-equal
// Suite 2: Semantic round-trip (parse → emit → re-parse)
// Suite 3: Property-based with fast-check
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import * as fc from 'fast-check';
import { parseYaml, serializeYaml } from '../yaml.js';
import { arbLinkMLSchema } from '../__fixtures__/generators.js';

// ─── Paths ────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '../__fixtures__/schemas');

const UPDATE_GOLDENS = process.env['UPDATE_GOLDENS'] === '1';

// All hand-authored + vendored schemas in the corpus (PTS-77 §5.1)
const CORPUS_SCHEMAS = [
  'minimal',
  'inheritance_chain',
  'mixins',
  'enums_with_meanings',
  'subsets',
  'imports_dep',
  'imports',
  'extras',
  'unicode',
  'mappings',
  'personinfo',
  'kitchen_sink',
] as const;

// ─── Suite 1 — Golden-file (byte-equal) ──────────────────────────────────────

describe('Suite 1 — Golden-file (byte-equal)', () => {
  for (const name of CORPUS_SCHEMAS) {
    it(`${name}: parse → emit matches ${name}.expected.yaml`, () => {
      const inputPath = resolve(FIXTURES_DIR, `${name}.yaml`);
      const expectedPath = resolve(FIXTURES_DIR, `${name}.expected.yaml`);

      const input = readFileSync(inputPath, 'utf-8');
      const schema = parseYaml(input);
      const emitted = serializeYaml(schema);

      if (UPDATE_GOLDENS) {
        writeFileSync(expectedPath, emitted, 'utf-8');
        return;
      }

      const expected = readFileSync(expectedPath, 'utf-8');
      // Use toBe so Vitest prints a character-level diff on failure
      expect(emitted).toBe(expected);
    });
  }
});

// ─── Suite 2 — Semantic round-trip ───────────────────────────────────────────

describe('Suite 2 — Semantic round-trip', () => {
  for (const name of CORPUS_SCHEMAS) {
    it(`${name}: parse(emit(parse(input))) deep-equals parse(input)`, () => {
      const inputPath = resolve(FIXTURES_DIR, `${name}.yaml`);
      const input = readFileSync(inputPath, 'utf-8');

      const once = parseYaml(input);
      const reparsed = parseYaml(serializeYaml(once));

      expect(reparsed).toEqual(once);
    });
  }
});

// ─── Suite 3 — Property-based (fast-check) ───────────────────────────────────

describe('Suite 3 — Property-based (fast-check)', () => {
  it('∀ schema: parse(emit(schema)) deep-equals schema (≥200 cases)', () => {
    fc.assert(
      fc.property(arbLinkMLSchema, schema => {
        const emitted = serializeYaml(schema);
        const reparsed = parseYaml(emitted);
        // Vitest assertions throw on failure; fast-check catches and shrinks.
        expect(reparsed).toEqual(schema);
      }),
      {
        numRuns: 200,
        // fast-check logs the seed automatically on failure for reproduction
      },
    );
  });
});
