# markdown-i18n

Deterministic Markdown i18n preprocessor for maintaining one multilingual Markdown source and compiling localized output files.

## What It Does

You write a single source file such as `README.i18n.md` and compile it into multiple localized files:

- `README.md`
- `README.en.md`
- `README.es.md`
- `README.pt.md`

This keeps documentation in one place while still producing language-specific Markdown files for publishing.

## Features

- simple `:::lang <code>` block syntax
- shared content outside language blocks
- multiple languages per block
- deterministic output
- fenced code block awareness
- missing translation detection
- optional default output file such as `README.md`
- watch mode for automatic rebuilds

## Install

This project currently uses plain Node.js with no external runtime dependencies.

Requirements:

- Node.js installed and available in `PATH`

For local development:

```powershell
npm install
```

## Project Structure

```text
scripts/build-readme.js
src/README.i18n.md
dist/
test/build-readme.test.js
```

## Syntax

### Common Content

Any Markdown outside `:::lang` blocks is copied to every generated language file.

```md
# My Project

This paragraph appears in all outputs.
```

### Single Language Block

```md
:::lang en
Hello world
:::

:::lang es
Hola mundo
:::
```

### Shared Block For Multiple Languages

```md
:::lang en,es
This content is shared by English and Spanish.
:::
```

### Fenced Code Blocks

Language markers inside fenced code blocks are ignored by the parser.

````md
```js
const marker = ":::lang en";
```
````

### Ignore Sections

Ignore sections are preserved as-is.

````md
<!-- i18n-ignore-start -->
```bash
npm install
```
<!-- i18n-ignore-end -->
````

## Build

Run:

```powershell
node .\scripts\build-readme.js build .\src\README.i18n.md --langs en,es,pt --out-dir .\dist --default en
```

This generates:

- `dist/README.en.md`
- `dist/README.es.md`
- `dist/README.pt.md`
- `dist/README.md`

## Check

Validate structure and missing translations without writing output files:

```powershell
node .\scripts\build-readme.js check .\src\README.i18n.md --langs en,es,pt
```

If validation passes, the command prints:

```text
md-i18n: check passed
```

## Watch

Rebuild automatically when `*.i18n.md` files change.

Watch one file:

```powershell
node .\scripts\build-readme.js watch .\src\README.i18n.md --langs en,es,pt --out-dir .\dist --default en
```

Watch a directory:

```powershell
node .\scripts\build-readme.js watch .\src --langs en,es,pt --out-dir .\dist --default en
```

Behavior:

- builds all matching `.i18n.md` files once at startup
- watches those files for changes
- recompiles automatically after each save
- writes outputs without needing a manual build command

Current watch limitation:

- if you create a new `.i18n.md` file after watch has already started, restart the watcher so it begins tracking that file

## CLI Options

```text
md-i18n build <input> --langs en,es,pt [options]
md-i18n check <input> --langs en,es,pt [options]
md-i18n watch <path> --langs en,es,pt [options]

--langs <list>           Comma-separated target languages
--out-dir <dir>          Output directory
--default <lang>         Also emit README.md using this language
--default-name <file>    Default output file name
--allow-missing          Do not fail when a localized group misses languages
```

## Missing Translation Detection

By default, the build fails if a localized group does not cover all requested languages.

Example:

```md
:::lang en
Hello
:::

:::lang es
Hola
:::
```

If you build with:

```powershell
node .\scripts\build-readme.js build .\src\README.i18n.md --langs en,es,pt
```

the compiler fails because `pt` is missing for that localized group.

If you want to allow partial translations:

```powershell
node .\scripts\build-readme.js build .\src\README.i18n.md --langs en,es,pt --allow-missing
```

## Tests

Run the automated tests with:

```powershell
node --test --test-isolation=none
```

Or through npm:

```powershell
npm test
```

The current test suite covers:

- common vs localized content
- fenced code block handling
- missing translation detection
- output generation
- optional missing translation allowance
- watch-related path handling

## Example Workflow

1. Edit `src/README.i18n.md`
2. Run `check`
3. Start `watch` during active editing, or run the build command manually
4. Run the tests
5. Review the generated files in `dist/`

## npm Package Usage

Once published, a consumer project would typically install it with:

```powershell
npm install -D markdown-i18n
```

Then use it through scripts:

```json
{
  "scripts": {
    "docs:check": "md-i18n check README.i18n.md --langs en,es,pt",
    "docs:build": "md-i18n build README.i18n.md --langs en,es,pt --out-dir . --default en",
    "docs:watch": "md-i18n watch . --langs en,es,pt --out-dir . --default en"
  }
}
```

That gives the user the workflow:

1. edit `README.i18n.md`
2. leave `docs:watch` running during edits
3. run `docs:check` in CI or before commit

## Publishing

Before first publish:

1. verify the package name you want on npm
2. bump the version in `package.json`
3. add a repository remote and then fill `repository`, `homepage`, and `bugs`
4. create an npm access token and store it as `NPM_TOKEN` in GitHub Actions secrets

Manual local publish:

```powershell
npm publish
```

Automated publish:

- the repo includes `.github/workflows/publish.yml`
- publishing a GitHub release, or manually dispatching the workflow, will publish to npm
- `prepublishOnly` runs tests and `check` before publish

Before enabling the publish workflow in GitHub Actions, update `package.json` with your real repository URLs.

## Status

Current implementation is intentionally minimal:

- no external dependencies
- no Markdown AST
- no runtime translation
- no editor integration yet

## License

MIT
