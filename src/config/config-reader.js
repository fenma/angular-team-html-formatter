"use strict";

const fs = require("fs");
const path = require("path");
const { DEFAULT_CONFIG } = require("./default-config");
const { isVoidTag } = require("../html/void-tags");
const { getTagSettingConstraint } = require("../html/tag-setting-constraints");

/**
 * Preferred config file name.
 * `html-formatter.config.jsonc` is explicit, repo-friendly and supports comments for team rules.
 */
const PREFERRED_CONFIG_FILE = "html-formatter.config.jsonc";

/**
 * @param {vscode.TextDocument | undefined} document
 * @returns {string | null}
 */
function getDocumentDirectory(document) {
  if (!document || !document.uri || document.uri.scheme !== "file") {
    return null;
  }

  return path.dirname(document.uri.fsPath);
}

/**
 * @param {vscode.TextDocument | undefined} document
 * @param {{warn(message: string): void, debug(message: string): void}} logger
 * @returns {{config: object, filePath: string | null, diagnostics: string[]}}
 */
function readWorkspaceConfig(document, logger) {
  const vscode = require("vscode");
  const workspaceFolder = document ? vscode.workspace.getWorkspaceFolder(document.uri) : undefined;
  const diagnostics = [];

  if (!workspaceFolder) {
    diagnostics.push("No workspace folder found. Using safe formatter defaults.");
    return {
      config: clone(DEFAULT_CONFIG),
      filePath: null,
      diagnostics
    };
  }

  const configFilePath = findConfigFile(workspaceFolder.uri.fsPath, getDocumentDirectory(document));

  if (!configFilePath) {
    diagnostics.push(
      `No formatter config found. Looked for ${DEFAULT_CONFIG.configFileNames.join(", ")}. Using indent-only defaults.`
    );

    return {
      config: clone(DEFAULT_CONFIG),
      filePath: null,
      diagnostics
    };
  }

  try {
    const raw = fs.readFileSync(configFilePath, "utf8");
    const parsed = parseJsonc(raw);
    const normalized = normalizeConfig(parsed, diagnostics);

    logger.debug(`Loaded formatter config from ${configFilePath}`);

    return {
      config: normalized,
      filePath: configFilePath,
      diagnostics
    };
  } catch (error) {
    const message = `Failed to read formatter config at ${configFilePath}: ${error.message}`;
    diagnostics.push(message);
    logger.warn(message);

    return {
      config: clone(DEFAULT_CONFIG),
      filePath: configFilePath,
      diagnostics
    };
  }
}

/**
 * Search from the current document folder upward so nested packages can keep
 * their own formatter config without changing the VS Code workspace root.
 *
 * @param {string} workspaceRoot
 * @param {string | null} [startDirectory]
 * @returns {string | null}
 */
function findConfigFile(workspaceRoot, startDirectory = null) {
  const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
  let currentDirectory = startDirectory ? path.resolve(startDirectory) : normalizedWorkspaceRoot;

  if (!isSameOrChildPath(normalizedWorkspaceRoot, currentDirectory)) {
    currentDirectory = normalizedWorkspaceRoot;
  }

  while (true) {
    for (const fileName of DEFAULT_CONFIG.configFileNames) {
      const candidate = path.join(currentDirectory, fileName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    if (currentDirectory === normalizedWorkspaceRoot) {
      return null;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory || !isSameOrChildPath(normalizedWorkspaceRoot, parentDirectory)) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

/**
 * @param {string} parentPath
 * @param {string} targetPath
 * @returns {boolean}
 */
function isSameOrChildPath(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

/**
 * @param {string} text
 * @returns {any}
 */
function parseJsonc(text) {
  const withoutComments = stripJsonComments(text);
  const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(withoutTrailingCommas);
}

/**
 * Removes JSONC comments while preserving comment-like text inside strings.
 *
 * @param {string} text
 * @returns {string}
 */
function stripJsonComments(text) {
  let output = "";
  let index = 0;
  let inString = false;
  let stringQuote = null;

  while (index < text.length) {
    const current = text[index];
    const next = text[index + 1];

    if (inString) {
      output += current;

      if (current === "\\") {
        if (index + 1 < text.length) {
          output += text[index + 1];
          index += 2;
          continue;
        }
      } else if (current === stringQuote) {
        inString = false;
        stringQuote = null;
      }

      index += 1;
      continue;
    }

    if (current === "\"" || current === "'") {
      inString = true;
      stringQuote = current;
      output += current;
      index += 1;
      continue;
    }

    if (current === "/" && next === "/") {
      index += 2;
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (index < text.length) {
        if (text[index] === "*" && text[index + 1] === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }

    output += current;
    index += 1;
  }

  return output;
}

/**
 * @param {any} parsed
 * @param {string[]} diagnostics
 * @returns {object}
 */
function normalizeConfig(parsed, diagnostics) {
  const config = clone(DEFAULT_CONFIG);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    diagnostics.push("Config root must be an object. Falling back to defaults.");
    return config;
  }

  if (typeof parsed.indentSize === "number" || typeof parsed.useTabs === "boolean") {
    config.indent = {
      size: Number.isInteger(parsed.indentSize) && parsed.indentSize > 0 ? parsed.indentSize : config.indent.size,
      useTabs: typeof parsed.useTabs === "boolean" ? parsed.useTabs : config.indent.useTabs
    };
  }

  if (parsed.indent && typeof parsed.indent === "object") {
    config.indent = {
      size:
        Number.isInteger(parsed.indent.size) && parsed.indent.size > 0 ? parsed.indent.size : config.indent.size,
      useTabs: typeof parsed.indent.useTabs === "boolean" ? parsed.indent.useTabs : config.indent.useTabs
    };
  }

  if (parsed.defaultBehavior && typeof parsed.defaultBehavior === "object") {
    config.defaultBehavior = {
      unknownTags:
        parsed.defaultBehavior.unknownTags === "indent-only"
          ? "indent-only"
          : DEFAULT_CONFIG.defaultBehavior.unknownTags
    };
  }

  if (parsed.knownTagDefaults && typeof parsed.knownTagDefaults === "object") {
    config.knownTagDefaults = normalizeTagRule(
      parsed.knownTagDefaults,
      "knownTagDefaults",
      diagnostics,
      clone(DEFAULT_CONFIG.knownTagDefaults)
    );
  }

  if (parsed.tags && typeof parsed.tags === "object" && !Array.isArray(parsed.tags)) {
    for (const [tagName, rule] of Object.entries(parsed.tags)) {
      if (!tagName || typeof rule !== "object" || !rule) {
        diagnostics.push(`Ignoring invalid tag rule for "${String(tagName)}".`);
        continue;
      }

      config.tags[tagName.toLowerCase()] = normalizeTagRule(rule, tagName, diagnostics, {});
    }
  }

  return config;
}

/**
 * @param {any} rule
 * @param {string} tagName
 * @param {string[]} diagnostics
 * @param {object} baseRule
 * @returns {object}
 */
function normalizeTagRule(rule, tagName, diagnostics, baseRule) {
  const normalized = clone(baseRule);
  const voidTag = isVoidTag(String(tagName).toLowerCase());

  if (Array.isArray(rule.firstLineAttributes)) {
    normalized.firstLineAttributes = rule.firstLineAttributes
      .map((entry) => normalizeAttributeOrderEntry(entry, tagName, diagnostics))
      .filter(Boolean);
  }

  if (Array.isArray(rule.attributeOrder)) {
    normalized.attributeOrder = rule.attributeOrder
      .map((entry) => normalizeAttributeOrderEntry(entry, tagName, diagnostics))
      .filter(Boolean);
  }

  if (["preserve", "multi-line", "single-line"].includes(rule.attributeLayout)) {
    normalized.attributeLayout = rule.attributeLayout;
  }

  if (Number.isInteger(rule.maxAttributeLineWidth) && rule.maxAttributeLineWidth > 0) {
    normalized.maxAttributeLineWidth = rule.maxAttributeLineWidth;
  }

  if (rule.unknownAttributesPosition === "first" || rule.unknownAttributesPosition === "last") {
    normalized.unknownAttributesPosition = rule.unknownAttributesPosition;
  }

  if (rule.sortUnknownAttributes === "preserve" || rule.sortUnknownAttributes === "alphabetical") {
    normalized.sortUnknownAttributes = rule.sortUnknownAttributes;
  }

  if (["preserve", "self-closing", "explicit"].includes(rule.closingStyle)) {
    const closingStyleConstraint = getTagSettingConstraint(tagName, "closingStyle", rule.closingStyle);
    if (closingStyleConstraint) {
      diagnostics.push(closingStyleConstraint.normalizeMessage);
    } else {
      normalized.closingStyle = rule.closingStyle;
    }
  }

  if (["preserve", "same-line", "next-line"].includes(rule.closingBracketPosition)) {
    normalized.closingBracketPosition = rule.closingBracketPosition;
  }

  if (["preserve", "same-line", "next-line"].includes(rule.closingTagPosition)) {
    if (voidTag) {
      diagnostics.push(`Ignoring closingTagPosition on void tag "${tagName}". Void tags do not have end tags.`);
    } else if (normalized.closingStyle === "self-closing" || rule.closingStyle === "self-closing") {
      diagnostics.push(
        `Ignoring closingTagPosition on tag "${tagName}" because closingStyle "self-closing" does not use an end tag.`
      );
    } else {
      normalized.closingTagPosition = rule.closingTagPosition;
    }
  }

  return normalized;
}

/**
 * @param {any} entry
 * @param {string} tagName
 * @param {string[]} diagnostics
 * @returns {{name?: string, pattern?: string, flags?: string, kinds: string[] | null} | null}
 */
function normalizeAttributeOrderEntry(entry, tagName, diagnostics) {
  if (typeof entry === "string" && entry.trim()) {
    return {
      name: entry.trim(),
      kinds: null
    };
  }

  if (entry && typeof entry === "object" && typeof entry.name === "string" && entry.name.trim()) {
    const kinds = Array.isArray(entry.kinds)
      ? entry.kinds.filter((kind) =>
          ["plain", "property", "event", "two-way", "structural", "template-ref"].includes(kind)
        )
      : null;

    return {
      name: entry.name.trim(),
      kinds: kinds && kinds.length ? kinds : null
    };
  }

  if (entry && typeof entry === "object" && typeof entry.pattern === "string" && entry.pattern.trim()) {
    const kinds = Array.isArray(entry.kinds)
      ? entry.kinds.filter((kind) =>
          ["plain", "property", "event", "two-way", "structural", "template-ref"].includes(kind)
        )
      : null;
    const flags = typeof entry.flags === "string" ? entry.flags : "";

    try {
      new RegExp(entry.pattern, flags);
    } catch (error) {
      diagnostics.push(`Ignoring invalid attributeOrder regex entry on "${tagName}": ${error.message}`);
      return null;
    }

    return {
      pattern: entry.pattern,
      flags,
      kinds: kinds && kinds.length ? kinds : null
    };
  }

  diagnostics.push(`Ignoring invalid attributeOrder entry on "${tagName}".`);
  return null;
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  PREFERRED_CONFIG_FILE,
  findConfigFile,
  getDocumentDirectory,
  isSameOrChildPath,
  normalizeConfig,
  parseJsonc,
  readWorkspaceConfig
};
