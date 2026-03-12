const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  build,
  compileFile,
  compileLanguage,
  createFileOptions,
  findMissingTranslations,
  getWatchFiles,
  isI18nFile,
  parseMarkdown,
  parseCli,
  writeOutputs
} = require("../scripts/build-readme.js");

test("compileLanguage keeps common content and matching localized blocks", () => {
  const source = [
    "# Title",
    "",
    ":::lang en",
    "Hello",
    ":::",
    "",
    ":::lang es",
    "Hola",
    ":::",
    ""
  ].join("\n");

  const parsed = parseMarkdown(source);

  assert.equal(compileLanguage(parsed, "en"), "# Title\n\nHello\n\n");
  assert.equal(compileLanguage(parsed, "es"), "# Title\n\n\nHola\n");
});

test("parser ignores markers inside fenced code blocks", () => {
  const source = [
    "```js",
    'const marker = ":::lang en";',
    "```",
    "",
    ":::lang en",
    "Visible",
    ":::",
    ""
  ].join("\n");

  const parsed = parseMarkdown(source);

  assert.equal(
    compileLanguage(parsed, "en"),
    "```js\nconst marker = \":::lang en\";\n```\n\nVisible\n"
  );
});

test("missing translation detection reports localized groups with absent languages", () => {
  const source = [
    "# Title",
    "",
    ":::lang en",
    "Hello",
    ":::",
    "",
    ":::lang es",
    "Hola",
    ":::",
    "",
    "Plain paragraph",
    "",
    ":::lang en,es",
    "Shared",
    ":::",
    ""
  ].join("\n");

  const parsed = parseMarkdown(source);
  const missing = findMissingTranslations(parsed, ["en", "es", "pt"]);

  assert.deepEqual(missing, [
    { line: 3, missingLangs: ["pt"] },
    { line: 13, missingLangs: ["pt"] }
  ]);
});

test("build writes compiled outputs and README.md for default language", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "md-i18n-"));
  const inputPath = path.join(tempDir, "README.i18n.md");
  const outDir = path.join(tempDir, "dist");

  const source = [
    "# Demo",
    "",
    ":::lang en,es",
    "Shared localized content",
    ":::",
    "",
    "Tail",
    ""
  ].join("\n");

  fs.writeFileSync(inputPath, source, "utf8");

  const parsed = build({
    input: inputPath,
    outDir,
    langs: ["en", "es"],
    defaultLang: "en",
    defaultName: "README.md",
    allowMissing: false
  });

  writeOutputs(
    {
      input: inputPath,
      outDir,
      langs: ["en", "es"],
      defaultLang: "en",
      defaultName: "README.md",
      allowMissing: false
    },
    parsed
  );

  assert.equal(
    fs.readFileSync(path.join(outDir, "README.en.md"), "utf8"),
    "# Demo\n\nShared localized content\n\nTail\n"
  );
  assert.equal(
    fs.readFileSync(path.join(outDir, "README.es.md"), "utf8"),
    "# Demo\n\nShared localized content\n\nTail\n"
  );
  assert.equal(
    fs.readFileSync(path.join(outDir, "README.md"), "utf8"),
    "# Demo\n\nShared localized content\n\nTail\n"
  );
});

test("build fails when translations are missing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "md-i18n-"));
  const inputPath = path.join(tempDir, "README.i18n.md");

  fs.writeFileSync(
    inputPath,
    [":::lang en", "Hello", ":::", ""].join("\n"),
    "utf8"
  );

  assert.throws(
    () =>
      build({
        input: inputPath,
        outDir: path.join(tempDir, "dist"),
        langs: ["en", "es"],
        defaultLang: null,
        defaultName: "README.md",
        allowMissing: false
      }),
    /Missing translations detected:/
  );
});

test("build can allow missing translations explicitly", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "md-i18n-"));
  const inputPath = path.join(tempDir, "README.i18n.md");
  const outDir = path.join(tempDir, "dist");

  fs.writeFileSync(
    inputPath,
    [":::lang en", "Hello", ":::", ""].join("\n"),
    "utf8"
  );

  const parsed = build({
    input: inputPath,
    outDir,
    langs: ["en", "es"],
    defaultLang: null,
    defaultName: "README.md",
    allowMissing: true
  });

  writeOutputs(
    {
      input: inputPath,
      outDir,
      langs: ["en", "es"],
      defaultLang: null,
      defaultName: "README.md",
      allowMissing: true
    },
    parsed
  );

  assert.equal(fs.readFileSync(path.join(outDir, "README.en.md"), "utf8"), "Hello\n");
  assert.equal(fs.readFileSync(path.join(outDir, "README.es.md"), "utf8"), "\n");
});

test("build validates successfully without writing files until requested", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "md-i18n-"));
  const inputPath = path.join(tempDir, "README.i18n.md");
  const outDir = path.join(tempDir, "dist");

  fs.writeFileSync(
    inputPath,
    [":::lang en,es", "Hello", ":::", ""].join("\n"),
    "utf8"
  );

  const parsed = build({
    input: inputPath,
    outDir,
    langs: ["en", "es"],
    defaultLang: null,
    defaultName: "README.md",
    allowMissing: false
  });

  assert.equal(fs.existsSync(outDir), false);
  assert.equal(parsed.localizedGroups.length, 1);
});

test("parseCli supports watch mode", () => {
  const options = parseCli(["watch", ".", "--langs", "en,es", "--default", "en"]);

  assert.equal(options.command, "watch");
  assert.deepEqual(options.langs, ["en", "es"]);
  assert.equal(options.defaultLang, "en");
});

test("isI18nFile detects only i18n markdown files", () => {
  assert.equal(isI18nFile("README.i18n.md"), true);
  assert.equal(isI18nFile("readme.I18N.md"), true);
  assert.equal(isI18nFile("README.md"), false);
});

test("getWatchFiles returns a sorted list of i18n files in a directory", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "md-i18n-watch-"));

  fs.writeFileSync(path.join(tempDir, "b.i18n.md"), "", "utf8");
  fs.writeFileSync(path.join(tempDir, "a.i18n.md"), "", "utf8");
  fs.writeFileSync(path.join(tempDir, "README.md"), "", "utf8");

  assert.deepEqual(getWatchFiles(tempDir), [
    path.join(tempDir, "a.i18n.md"),
    path.join(tempDir, "b.i18n.md")
  ]);
});

test("compileFile builds outputs directly for build mode", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "md-i18n-compile-"));
  const inputPath = path.join(tempDir, "README.i18n.md");
  const outDir = path.join(tempDir, "dist");

  fs.writeFileSync(
    inputPath,
    ["# Title", "", ":::lang en,es", "Hello", ":::", ""].join("\n"),
    "utf8"
  );

  const result = compileFile({
    command: "build",
    input: inputPath,
    outDir,
    langs: ["en", "es"],
    defaultLang: "en",
    defaultName: "README.md",
    allowMissing: false
  });

  assert.equal(result.mode, "build");
  assert.equal(fs.existsSync(path.join(outDir, "README.en.md")), true);
  assert.equal(fs.existsSync(path.join(outDir, "README.es.md")), true);
  assert.equal(fs.existsSync(path.join(outDir, "README.md")), true);
});

test("createFileOptions maps a watched file into build options", () => {
  const baseOptions = {
    command: "watch",
    input: "ignored",
    outDir: "g:\\out",
    langs: ["en", "es"],
    defaultLang: "en",
    defaultName: "README.md",
    allowMissing: false
  };

  const mapped = createFileOptions(baseOptions, "g:\\docs\\README.i18n.md");

  assert.equal(mapped.command, "build");
  assert.equal(mapped.input, "g:\\docs\\README.i18n.md");
  assert.equal(mapped.outDir, "g:\\out");
});
