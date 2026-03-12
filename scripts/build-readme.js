#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function printHelp() {
  const help = [
    "md-i18n build <input> --langs en,es,pt [options]",
    "md-i18n check <input> --langs en,es,pt [options]",
    "md-i18n watch <path> --langs en,es,pt [options]",
    "",
    "Options:",
    "  --langs <list>           Comma-separated target languages",
    "  --out-dir <dir>          Output directory (default: input directory)",
    "  --default <lang>         Also emit README.md using this language",
    "  --default-name <file>    Default output file name (default: README.md)",
    "  --allow-missing          Do not fail when a localized group misses languages"
  ];

  console.log(help.join("\n"));
}

function parseCli(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const [command, input, ...rest] = argv;

  if (!["build", "check", "watch"].includes(command)) {
    throw new Error(`Unsupported command: ${command}`);
  }

  if (!input) {
    throw new Error("Missing input path.");
  }

  const resolvedInput = path.resolve(input);
  const options = {
    allowMissing: false,
    command,
    defaultLang: null,
    defaultName: "README.md",
    input: resolvedInput,
    langs: [],
    outDir: fs.existsSync(resolvedInput) && fs.statSync(resolvedInput).isDirectory()
      ? resolvedInput
      : path.dirname(resolvedInput)
  };

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    const value = rest[i + 1];

    if (token === "--langs") {
      if (!value) {
        throw new Error("Missing value for --langs.");
      }
      options.langs = normalizeLangList(value);
      i += 1;
      continue;
    }

    if (token === "--out-dir") {
      if (!value) {
        throw new Error("Missing value for --out-dir.");
      }
      options.outDir = path.resolve(value);
      i += 1;
      continue;
    }

    if (token === "--default") {
      if (!value) {
        throw new Error("Missing value for --default.");
      }
      options.defaultLang = value.trim();
      i += 1;
      continue;
    }

    if (token === "--default-name") {
      if (!value) {
        throw new Error("Missing value for --default-name.");
      }
      options.defaultName = value.trim();
      i += 1;
      continue;
    }

    if (token === "--allow-missing") {
      options.allowMissing = true;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  if (options.langs.length === 0) {
    throw new Error("At least one language is required via --langs.");
  }

  return options;
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function normalizeLangList(rawValue) {
  return rawValue
    .split(",")
    .map((lang) => lang.trim())
    .filter(Boolean);
}

function isFenceDelimiter(trimmed) {
  return /^(```+|~~~+)/.test(trimmed);
}

function isI18nFile(filePath) {
  return /\.i18n\.md$/i.test(filePath);
}

function parseMarkdown(source) {
  const hasTrailingNewline = /\r?\n$/.test(source);
  const normalizedSource = stripBom(source).replace(/\r\n/g, "\n");
  const lines = normalizedSource.split("\n");
  if (hasTrailingNewline) {
    lines.pop();
  }
  const segments = [];
  const localizedGroups = [];

  let insideFence = false;
  let insideIgnore = false;
  let activeBlock = null;
  let currentGroup = null;

  function pushCommon(line) {
    if (currentGroup) {
      if (line.trim() === "") {
        currentGroup.pendingBlankLines.push(line);
        return;
      }

      for (const blankLine of currentGroup.pendingBlankLines) {
        segments.push({ type: "common", line: blankLine });
      }
      currentGroup.pendingBlankLines = [];
      currentGroup = null;
    }

    segments.push({ type: "common", line });
  }

  function ensureGroup(lineNumber) {
    if (!currentGroup) {
      currentGroup = {
        startLine: lineNumber,
        langs: new Set(),
        pendingBlankLines: []
      };
      localizedGroups.push(currentGroup);
    } else if (currentGroup.pendingBlankLines.length > 0) {
      for (const blankLine of currentGroup.pendingBlankLines) {
        segments.push({ type: "common", line: blankLine });
      }
      currentGroup.pendingBlankLines = [];
    }
  }

  function pushLocalized(line, langs, lineNumber) {
    ensureGroup(lineNumber);
    for (const lang of langs) {
      currentGroup.langs.add(lang);
    }
    segments.push({ type: "localized", langs, line });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (trimmed === "<!-- i18n-ignore-start -->") {
      insideIgnore = true;
      if (activeBlock) {
        pushLocalized(line, activeBlock.langs, lineNumber);
      } else {
        pushCommon(line);
      }
      continue;
    }

    if (trimmed === "<!-- i18n-ignore-end -->") {
      if (activeBlock) {
        pushLocalized(line, activeBlock.langs, lineNumber);
      } else {
        pushCommon(line);
      }
      insideIgnore = false;
      continue;
    }

    if (!insideIgnore && isFenceDelimiter(trimmed)) {
      insideFence = !insideFence;
      if (activeBlock) {
        pushLocalized(line, activeBlock.langs, lineNumber);
      } else {
        pushCommon(line);
      }
      continue;
    }

    if (!insideFence && !insideIgnore) {
      const startMatch = trimmed.match(/^:::lang\s+(.+)$/);

      if (startMatch) {
        if (activeBlock) {
          throw new Error("Nested :::lang blocks are not supported.");
        }

        const langs = normalizeLangList(startMatch[1]);
        if (langs.length === 0) {
          throw new Error("Empty :::lang declaration.");
        }

        activeBlock = { langs, startLine: lineNumber };
        ensureGroup(lineNumber);
        for (const lang of langs) {
          currentGroup.langs.add(lang);
        }
        continue;
      }

      if (trimmed === ":::" && activeBlock) {
        activeBlock = null;
        continue;
      }
    }

    if (activeBlock) {
      pushLocalized(line, activeBlock.langs, lineNumber);
    } else {
      pushCommon(line);
    }
  }

  if (activeBlock) {
    throw new Error(`Unclosed :::lang block starting at line ${activeBlock.startLine}.`);
  }

  return {
    hasTrailingNewline,
    localizedGroups: localizedGroups.map((group) => ({
      startLine: group.startLine,
      langs: Array.from(group.langs).sort()
    })),
    segments
  };
}

function findMissingTranslations(parsed, targetLangs) {
  const missing = [];

  for (const group of parsed.localizedGroups) {
    const absent = targetLangs.filter((lang) => !group.langs.includes(lang));
    if (absent.length > 0) {
      missing.push({
        line: group.startLine,
        missingLangs: absent
      });
    }
  }

  return missing;
}

function formatMissingTranslations(missing) {
  return missing
    .map((entry) => `line ${entry.line}: missing ${entry.missingLangs.join(", ")}`)
    .join("\n");
}

function compileLanguage(parsed, lang) {
  const lines = [];

  for (const segment of parsed.segments) {
    if (segment.type === "common") {
      lines.push(segment.line);
      continue;
    }

    if (segment.langs.includes(lang)) {
      lines.push(segment.line);
    }
  }

  let output = lines.join("\n");
  if (parsed.hasTrailingNewline) {
    output += "\n";
  }
  return output;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getOutputFileName(inputPath, lang) {
  const baseName = path.basename(inputPath);
  return baseName.replace(/\.i18n\.md$/i, `.${lang}.md`);
}

function validateOptions(options) {
  if (options.defaultLang && !options.langs.includes(options.defaultLang)) {
    throw new Error(`Default language "${options.defaultLang}" must also be listed in --langs.`);
  }
}

function build(options) {
  validateOptions(options);

  const source = fs.readFileSync(options.input, "utf8");
  const parsed = parseMarkdown(source);

  if (!options.allowMissing) {
    const missing = findMissingTranslations(parsed, options.langs);
    if (missing.length > 0) {
      throw new Error(`Missing translations detected:\n${formatMissingTranslations(missing)}`);
    }
  }

  return parsed;
}

function writeOutputs(options, parsed) {
  ensureDirectory(options.outDir);

  for (const lang of options.langs) {
    const compiled = compileLanguage(parsed, lang);
    const fileName = getOutputFileName(options.input, lang);
    fs.writeFileSync(path.join(options.outDir, fileName), compiled, "utf8");
  }

  if (options.defaultLang) {
    const defaultOutput = compileLanguage(parsed, options.defaultLang);
    fs.writeFileSync(path.join(options.outDir, options.defaultName), defaultOutput, "utf8");
  }
}

function compileFile(options) {
  const parsed = build(options);

  if (options.command === "check") {
    return {
      mode: "check",
      parsed
    };
  }

  writeOutputs(options, parsed);
  return {
    mode: "build",
    parsed
  };
}

function getWatchFiles(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Path not found: ${inputPath}`);
  }

  const stats = fs.statSync(inputPath);
  if (stats.isFile()) {
    if (!isI18nFile(inputPath)) {
      throw new Error("Watch mode only supports files ending in .i18n.md.");
    }
    return [inputPath];
  }

  return fs
    .readdirSync(inputPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isI18nFile(entry.name))
    .map((entry) => path.join(inputPath, entry.name))
    .sort();
}

function diffWatchFiles(previousFiles, nextFiles) {
  const previous = new Set(previousFiles);
  const next = new Set(nextFiles);

  return {
    added: nextFiles.filter((filePath) => !previous.has(filePath)),
    removed: previousFiles.filter((filePath) => !next.has(filePath))
  };
}

function createFileOptions(baseOptions, filePath) {
  return {
    ...baseOptions,
    command: "build",
    input: filePath,
    outDir: baseOptions.outDir
  };
}

function runWatchBuild(baseOptions, filePath) {
  const fileOptions = createFileOptions(baseOptions, filePath);
  compileFile(fileOptions);
  console.log(`md-i18n: built ${path.basename(filePath)}`);
}

function startWatch(options) {
  const timers = new Map();
  const fileWatchers = new Map();
  const directoryPath = fs.existsSync(options.input) && fs.statSync(options.input).isDirectory()
    ? options.input
    : null;
  let watchedFiles = getWatchFiles(options.input);

  function watchFile(filePath) {
    if (fileWatchers.has(filePath)) {
      return;
    }

    const watcher = fs.watch(filePath, () => {
      clearTimeout(timers.get(filePath));
      const timer = setTimeout(() => {
        try {
          runWatchBuild(options, filePath);
        } catch (error) {
          console.error(`md-i18n: ${path.basename(filePath)} failed: ${error.message}`);
        }
      }, 50);

      timers.set(filePath, timer);
    });

    fileWatchers.set(filePath, watcher);
  }

  function unwatchFile(filePath) {
    clearTimeout(timers.get(filePath));
    timers.delete(filePath);

    const watcher = fileWatchers.get(filePath);
    if (watcher) {
      watcher.close();
      fileWatchers.delete(filePath);
    }
  }

  function refreshDirectoryWatch() {
    if (!directoryPath) {
      return;
    }

    const nextFiles = getWatchFiles(directoryPath);
    const diff = diffWatchFiles(watchedFiles, nextFiles);

    for (const filePath of diff.removed) {
      unwatchFile(filePath);
      console.log(`md-i18n: stopped watching ${path.basename(filePath)}`);
    }

    for (const filePath of diff.added) {
      try {
        runWatchBuild(options, filePath);
        watchFile(filePath);
        console.log(`md-i18n: started watching ${path.basename(filePath)}`);
      } catch (error) {
        console.error(`md-i18n: ${path.basename(filePath)} failed: ${error.message}`);
      }
    }

    watchedFiles = nextFiles;
  }

  for (const filePath of watchedFiles) {
    runWatchBuild(options, filePath);
    watchFile(filePath);
  }

  if (watchedFiles.length === 0) {
    console.log("md-i18n: no .i18n.md files found to watch");
  }

  let directoryWatcher = null;
  let directoryTimer = null;

  if (directoryPath) {
    directoryWatcher = fs.watch(directoryPath, () => {
      clearTimeout(directoryTimer);
      directoryTimer = setTimeout(() => {
        try {
          refreshDirectoryWatch();
        } catch (error) {
          console.error(`md-i18n: watch refresh failed: ${error.message}`);
        }
      }, 50);
    });
  }

  console.log(`md-i18n: watching ${watchedFiles.length} file(s)`);

  return {
    close() {
      clearTimeout(directoryTimer);
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      if (directoryWatcher) {
        directoryWatcher.close();
      }
      for (const watcher of fileWatchers.values()) {
        watcher.close();
      }
    }
  };
}

function main() {
  try {
    const options = parseCli(process.argv.slice(2));

    if (options.command === "watch") {
      startWatch(options);
      return;
    }

    compileFile(options);
    if (options.command === "check") {
      console.log("md-i18n: check passed");
    }
  } catch (error) {
    console.error(`md-i18n: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  build,
  compileFile,
  compileLanguage,
  createFileOptions,
  diffWatchFiles,
  findMissingTranslations,
  formatMissingTranslations,
  getWatchFiles,
  isI18nFile,
  parseMarkdown,
  parseCli,
  startWatch,
  writeOutputs
};
