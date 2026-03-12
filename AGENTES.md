AGENTS.md
Project Overview

This repository contains a Markdown i18n preprocessor that allows developers to maintain a single multilingual Markdown source file and compile it into multiple localized README files.

The goal is to simplify documentation localization while keeping a single source of truth.

Example:

Source file:

README.i18n.md

Compiled outputs:

README.md
README.en.md
README.es.md
README.fr.md
Core Concept

The project introduces a custom Markdown syntax for language blocks.

Example:

:::lang en
This project analyzes LLM failures.
::lang es
Este proyecto analiza fallos de LLM.
:::


The compiler extracts the correct blocks for each language and generates separate Markdown files.

---

# Repository Structure


src/
README.i18n.md

scripts/
build-readme.js

dist/
README.en.md
README.es.md

package.json


---

# Language Block Rules

### Syntax


:::lang <language>
content
:::


Examples:


:::lang en
Hello world
:::

:::lang es
Hola mundo
:::


### Multiple languages


:::lang es,pt
Texto compartido
:::


### Common content

Any Markdown outside `:::lang` blocks is copied to **all languages**.

Example:

My Project

Appears in every output file.

---

# Code Blocks

The parser **must ignore language markers inside fenced code blocks**.

Example:

const example = ":::lang en";

Language parsing must be disabled inside fenced code.

---

# Compilation Behavior

For each target language:

1. Copy common Markdown content
2. Insert language blocks matching the target language
3. Ignore other language blocks
4. Preserve Markdown formatting

Generated files:


README.en.md
README.es.md
README.pt.md


Optionally:


README.md → default language


---

# CLI Design

Planned CLI command:


md-i18n build README.i18n.md --langs en,es,pt


Expected output:


dist/
README.en.md
README.es.md
README.pt.md


---

# Non-Translatable Sections

The parser may support ignore blocks:

<!-- i18n-ignore-start -->

npm install my-package

<!-- i18n-ignore-end -->

Content inside these blocks must remain unchanged.

---

# Goals

The project aims to:

- simplify multilingual documentation
- avoid maintaining multiple README sources
- provide deterministic Markdown builds
- preserve code formatting
- be CI friendly

---

# Non-Goals

This project does **not** attempt to:

- dynamically translate Markdown at runtime
- modify GitHub rendering behavior
- execute JavaScript inside Markdown

All translations are compiled **before publishing**.

---

# Recommended Improvements

Future features may include:

- automatic translation fallback
- missing translation detection
- language switcher generation
- VSCode extension
- CI integration
- AST-based Markdown parsing

---

# Agent Guidelines

Agents modifying this repository should:

1. Preserve Markdown formatting
2. Avoid altering language block syntax
3. Ensure generated files are deterministic
4. Avoid modifying source `.i18n.md` unintentionally
5. Maintain compatibility with existing language blocks

When generating code, prefer:

- simple parsers
- deterministic builds
- minimal dependencies

---

# Example Build

Input:


README.i18n.md


Languages:


en, es


Output:


README.en.md
README.es.md
README.md


---

# License

MIT
:::

---