### How this project was built

This document describes how the LinkML Visual Schema Editor was developed. It's here because the development process is unusual enough to be worth being explicit about, and because transparency about AI tool use in research software is becoming a community expectation.

### Roles

**My role (Adam Labadorf):** I am the architect, designer, reviewer, and maintainer of this project. I identified the gap this tool addresses, made the architectural and data-model decisions (technology stack, scope of LinkML metamodel coverage, round-trip strategy, platform abstraction, UI structure), co-authored the design specification with Claude (Anthropic), reviewed all generated code, and decide what ships. I am responsible for the codebase and for responding to issues, pull requests, and feedback.

**AI coding agents:** Implementation of the codebase against the specification was performed by AI coding agents — primarily Claude (Anthropic), running in an agent-orchestration environment. The agents wrote the TypeScript, React components, build configuration, tests, and most of the supporting code. I did not type the code by hand.

### Workflow

The development process was, roughly:

1. **Co-design.** Initial co-design conversations with Claude Opus to scope the tool, identify the v1.0 metamodel subset, and choose technologies.
2. **Design specification.** I co-authored a detailed design spec (`docs/design-spec.md`) with Claude Opus, intended specifically for execution by coding agents — explicit about data structures, file layouts, round-trip semantics, and acceptance criteria.
3. **Agent execution.** A team of coding agents implemented the spec, working from the document and from issues I filed in the repository.
4. **Review and integration.** I reviewed every diff, ran the code, evaluated outputs against the spec, filed follow-up issues for gaps, and integrated changes.

Decisions about what to build, how to build it, what was acceptable to ship, and what was not, were mine throughout.

### What this means for the code

* **Architecture is intentional.** The technology stack, data model, file structure, and platform abstraction were designed before any code was written. The spec is in the repo for review.
* **Coverage is intentional.** The v1.0 scope (which LinkML metamodel constructs the UI exposes vs. round-trips through `extras`) is a deliberate design choice, not an artifact of where an agent stopped.
* **The code has been read.** I have reviewed all the code that was written. I cannot guarantee it is bug-free — no project can — but I can guarantee it is not unread.

### What this means for contributors and users

* **Issues will get real responses.** I read and respond to issues myself. Bug reports, feature requests, and questions about design are all welcome.
* **PRs will get real review.** I review pull requests with the aid of AI coding assistants on the basis of the design spec, the existing architecture, and project goals — the same way any maintainer would. PRs that don't fit the design will get substantive feedback explaining why.
* **The project is maintained.** This is an active, ongoing project, not a one-shot artifact. I built it because I want to use it.

### My background

For context: I am a bioinformatics researcher with a long background in software development across several languages and stacks. I am not, by trade, a TypeScript developer — TypeScript was a deliberate choice for this project (the React/ReactFlow ecosystem is the strongest fit for the canvas-based UI we needed), and I relied on coding agents to bridge the language-specific gap. The architectural decisions, data-model design, and user-experience choices draw on standard software-engineering practice and on substantial first-hand experience modeling research data.

### Limitations and ongoing posture

Agent-implemented code is good at executing well-specified work and less good at making judgment calls in ambiguous situations. The areas of the codebase where I have spent the most review effort are the LinkML round-trip serializer, the `extras` passthrough, and the inheritance/mixin handling — where correctness depends on a clear understanding of the LinkML metamodel rather than on coding fluency alone. Issues in these areas are particularly welcome.

Practices in this project may evolve as community norms around AI-assisted development settle. This document will be updated as the project does.
