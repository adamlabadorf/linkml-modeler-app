---
layout: home

hero:
  name: "LinkML Modeler App"
  text: "Visual editor for LinkML schemas"
  tagline: Model your data with a powerful, interactive graph editor. Design, validate, and export LinkML schemas visually.
  image:
    src: /logo.svg
    alt: LinkML Modeler App
  actions:
    - theme: brand
      text: Get Started
      link: /user-guide
    - theme: alt
      text: Developer Guide
      link: /development
    - theme: alt
      text: Design Spec
      link: /design-spec

features:
  - icon: 🎨
    title: Visual Schema Editing
    details: Drag-and-drop graph editor for LinkML classes, enums, and slots. Build your data model visually without writing YAML by hand.
  - icon: 📄
    title: LinkML YAML Generation
    details: Automatically generates valid LinkML YAML from your visual model. Export schemas ready for use with the LinkML toolchain.
  - icon: 🔗
    title: Git Integration
    details: Load and save schemas directly from Git repositories. Version-control your data models with full Git workflow support.
  - icon: 🗂️
    title: Multi-schema Support
    details: Work with multiple imported schemas simultaneously. Cross-schema references are validated and displayed as ghost nodes.
  - icon: 🖥️
    title: Cross-platform
    details: Runs as a web app in any modern browser, or as an Electron desktop application for a native experience on Mac, Windows, and Linux.
  - icon: 🔍
    title: Focus Mode
    details: Zoom in on selected entities and their relationships. Reduce visual clutter when working with large, complex schemas.

---

## Documentation

<div class="vp-doc" style="padding: 2rem 0">

| Section | Description |
|---|---|
| [User Guide](/user-guide) | Step-by-step instructions for loading schemas, editing nodes, and exporting YAML |
| [Developer Guide](/development) | Architecture overview, monorepo setup, and contributing guidelines |
| [Design Spec](/design-spec) | Product decisions, UI/UX rationale, and feature design documentation |

</div>
