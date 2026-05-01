# Quickstart: Your First LinkML Schema in 10 Minutes

This tutorial walks you through creating a small schema from scratch, connecting classes, validating your model, and exporting the YAML — all without writing a line of YAML by hand.

**What you'll build:** a simple bookstore schema with `Book`, `Author`, and a `Genre` enumeration.

---

## 1. Open the App and Start a New Project

Open the app in your browser:

- **Local development:** `pnpm dev`, then visit [http://localhost:5173](http://localhost:5173)
- **Live demo:** [https://adamlabadorf.github.io/linkml-modeler-app/app/](https://adamlabadorf.github.io/linkml-modeler-app/app/)

The **splash page** appears. Click **New Empty Project**.

The canvas opens with a single blank schema file (`untitled_schema.yaml`) already loaded in the Project Panel on the left.

::: tip Want to skip ahead?
Download the [sample schemas](#sample-schemas) and open them with **Open Local Folder** instead.
:::

---

## 2. Add Your First Class

Right-click anywhere on the empty canvas and choose **Add Class** from the context menu.

A new node named `ClassName` appears. It is immediately selected, and the **Properties Panel** on the right shows its editable fields.

1. In the **Name** field, type `Book` and press `Enter`.
2. In the **Description** field, type `A book in the bookstore catalog`.

The node on the canvas updates to show the new name.

---

## 3. Add Slots (Attributes) to Book

With `Book` still selected in the Properties Panel, scroll down to the **Attributes** section. Type a name in the text field and click **+ Add**.

Add the following attributes one at a time:

| Name | Range | Notes |
|---|---|---|
| `isbn` | `string` | Check **Identifier** |
| `title` | `string` | Check **Required** |
| `year_published` | `integer` | |
| `genre` | *(leave as string for now)* | You will change this after creating the enum |

::: tip Setting range
After adding an attribute, click its row in the Properties Panel to expand it. The **Range** dropdown lists built-in LinkML types (`string`, `integer`, `boolean`, `date`, …) and all classes and enums defined in your schema.
:::

---

## 4. Add the Author Class

Right-click the canvas again and choose **Add Class**. Name the new class `Author` and add these attributes:

| Name | Range | Notes |
|---|---|---|
| `name` | `string` | Check **Required** |
| `bio` | `string` | |

---

## 5. Add a Genre Enumeration

Right-click the canvas and choose **Add Enum**. Name the new enum `Genre`.

In the **Properties Panel**, type a value name in the permissible values field and click **+ Add**. Add these values one at a time:

- `fiction`
- `non_fiction`
- `mystery`
- `science_fiction`
- `biography`

---

## 6. Wire Up the Genre Range

Click the `Book` node to select it. In the Properties Panel, find the `genre` attribute and change its **Range** to `Genre` (the enum you just created). The dropdown will show all available types including your new enum.

---

## 7. Add Books ↔ Author Relationship

Click the `Book` node. Add a new attribute named `author` with **Range** set to `Author`.

Now you have a cross-class reference: `Book.author → Author`.

---

## 8. Connect Inheritance (Optional Bonus Step)

Suppose you want a `RareBook` that extends `Book`.

1. Right-click the canvas → **Add Class** → name it `RareBook`.
2. **Hover** over the `RareBook` node until small connection handles appear on its edges.
3. **Drag from a handle on `RareBook`** to any handle on `Book`. This creates an `is_a` relationship — an inheritance arrow on the canvas.
4. In the Properties Panel you will see `is_a: Book` already set.

Add a `condition` attribute (`string`) to `RareBook` to describe its preservation state.

---

## 9. Validate Your Schema

Click **✓ Validate** in the header (or press the button — it opens the **Validation Panel** at the bottom).

A schema with a `Book.isbn` marked as an identifier and a `Book.title` marked as required should validate cleanly. If you see any errors, the panel shows the affected element and a description — click to jump to it.

::: warning Common validation errors
- A slot's `range` points to a class or enum that no longer exists (e.g. you renamed it).
- A required identifier slot has no range set.
- Circular inheritance — class A `is_a` B `is_a` A.
:::

---

## 10. Inspect the YAML Preview

Look at the **YAML Preview** panel on the far right. It shows exactly what the editor would write to disk — a valid LinkML YAML document generated live from your visual model.

You should see output similar to:

```yaml
id: https://example.org/untitled_schema
name: untitled_schema
prefixes:
  linkml: https://w3id.org/linkml/
default_prefix: untitled_schema
imports:
  - linkml:types
classes:
  Book:
    description: A book in the bookstore catalog
    attributes:
      isbn:
        identifier: true
        range: string
      title:
        required: true
        range: string
      year_published:
        range: integer
      genre:
        range: Genre
      author:
        range: Author
  Author:
    description: ''
    attributes:
      name:
        required: true
        range: string
      bio:
        range: string
enums:
  Genre:
    permissible_values:
      fiction: {}
      non_fiction: {}
      mystery: {}
      science_fiction: {}
      biography: {}
```

---

## 11. Save Your Work

Press **Ctrl+S** (or **Cmd+S** on macOS).

Because this is a new project with no save location yet, a **directory picker** opens. Choose (or create) a folder on your machine — for example `~/schemas/bookstore`. The editor writes `untitled_schema.yaml` into that folder.

After saving, the **● unsaved changes** badge in the header disappears.

---

## 12. Reload and Verify Round-Trip

1. Go to **File** → **Open Project…** in the menu bar. This closes the current project and returns to the splash page.
2. On the splash page, click **Open Local Folder** and pick the `bookstore` folder you saved to.
3. The editor re-reads the YAML, rebuilds the canvas, and your schema is restored exactly.

The YAML Preview and the canvas should match what you left — confirming that the round-trip (visual → YAML → visual) preserves your model faithfully.

---

## What's Next?

- **[User Guide](./user-guide)** — detailed reference for every panel and feature.
- **Schema Settings** — click ⚙ in the header to set a real schema URI, add prefixes, or manage imports.
- **Multi-schema projects** — download the [pets + pets-base sample](#sample-schemas) to see how `imports:` work across multiple files in one project.
- **Git integration** — open the Git Panel at the bottom to commit your schema and track changes over time.

---

## Sample Schemas

Download these sample schemas to explore specific LinkML features in the editor. To use them:

1. Download the file(s) to a local folder.
2. On the app splash page, click **Open Local Folder** and select that folder.

### Beginner: Bookstore

A 3-class schema with a simple enum — a clean starting point.

**[Download bookstore.yaml](/linkml-modeler-app/samples/bookstore.yaml)**

Covers: classes, attributes, identifier slots, required slots, enumerations, cross-class ranges.

---

### Intermediate: Pet Registry (multi-schema import)

Two files — `pets.yaml` imports `pets_base.yaml` for a base `Animal` class and a `HealthStatus` enum.

**[Download pets_base.yaml](/linkml-modeler-app/samples/pets_base.yaml)** &nbsp;·&nbsp; **[Download pets.yaml](/linkml-modeler-app/samples/pets.yaml)**

Place **both files in the same folder** before opening. The editor resolves the import automatically.

Covers: multi-file projects, `imports:`, inherited classes, cross-schema ranges.

---

### Advanced: Library Catalog

A realistic schema with shared slots, URI mappings, subsets, validation rules, and email pattern constraints.

**[Download library_catalog.yaml](/linkml-modeler-app/samples/library_catalog.yaml)**

Covers: named slots, `slot_uri`, prefixes (schema:, dcterms:), subsets, `pattern`, `minimum_value` / `maximum_value`, conditional rules (`preconditions` / `postconditions`).
