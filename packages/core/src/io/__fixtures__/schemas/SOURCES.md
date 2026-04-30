# Schema Corpus — Upstream Sources

This directory contains the YAML schema corpus used by the LinkML Visual Schema Editor test suite.
Two schemas are vendored from upstream repositories; the remainder are hand-authored.

## Vendored Schemas

Do **not** update these files automatically. Treat upstream changes as deliberate corpus updates
that require an explicit review and PR.

### personinfo.yaml

- **Upstream repo:** https://github.com/linkml/linkml
- **File path:** `examples/PersonSchema/personinfo.yaml`
- **Commit SHA:** `9696e918da26b4b95caf36856263d69e8d997f3d`
- **Raw URL:** https://raw.githubusercontent.com/linkml/linkml/9696e918da26b4b95caf36856263d69e8d997f3d/examples/PersonSchema/personinfo.yaml
- **Purpose:** Canonical full-feature LinkML schema covering prefixes, imports, classes, slots,
  enums, and subsets. Used as the primary smoke-test schema for the golden-file round-trip suite.

### kitchen_sink.yaml

- **Upstream repo:** https://github.com/linkml/linkml-runtime
- **File path:** `tests/test_utils/input/kitchen_sink.yaml`
- **Commit SHA:** `2dc5048f546b7f0f67f2142b31472c32ca809232`
- **Raw URL:** https://raw.githubusercontent.com/linkml/linkml-runtime/2dc5048f546b7f0f67f2142b31472c32ca809232/tests/test_utils/input/kitchen_sink.yaml
- **Purpose:** Stresses metamodel coverage; exercises features that are uncommon in typical schemas.

## Hand-Authored Schemas

Each hand-authored schema is self-contained and targets a specific parser/emitter capability.

| File | Purpose |
|------|---------|
| `minimal.yaml` | Smallest valid schema (id, name, default_prefix only) |
| `inheritance_chain.yaml` | A → B → C → D four-level inheritance chain |
| `mixins.yaml` | Multiple mixin classes applied to a single concrete class |
| `enums_with_meanings.yaml` | Enums with `meaning` URIs and `code_set` declarations |
| `subsets.yaml` | Multiple named subsets; classes and slots carry `subset_of` |
| `imports_dep.yaml` | Dependency schema imported by `imports.yaml` |
| `imports.yaml` | Schema that imports `imports_dep` and extends its base class |
| `extras.yaml` | Slots and classes with unknown properties that must survive round-trip via the `extras` map |
| `unicode.yaml` | Non-ASCII class names, slot names, descriptions, and enum values |
| `mappings.yaml` | Slots with all five SKOS mapping types: `exact_mappings`, `close_mappings`, `broad_mappings`, `narrow_mappings`, `related_mappings` |

## Golden Files

Each `<name>.expected.yaml` file is the expected byte-equal output of `parse → emit` for the
corresponding `<name>.yaml` input. Golden files are initially identical to their inputs and are
regenerated with `pnpm test:update-goldens` after deliberate emitter changes.
