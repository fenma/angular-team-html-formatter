"use strict";

const fs = require("fs");
const path = require("path");
const { DEFAULT_CONFIG } = require("./default-config");

/**
 * Preferred config file name.
 * `html-formatter.config.jsonc` is explicit, repo-friendly and supports comments for team rules.
 */
const PREFERRED_CONFIG_FILE = "html-formatter.config.jsonc";

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

  const configFilePath = findConfigFile(workspaceFolder.uri.fsPath);

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
 * @param {string} workspaceRoot
 * @returns {string | null}
 */
function findConfigFile(workspaceRoot) {
  for (const fileName of DEFAULT_CONFIG.configFileNames) {
    const candidate = path.join(workspaceRoot, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * @param {string} text
 * @returns {any}
 */
function parseJsonc(text) {
  const withoutComments = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(withoutTrailingCommas);
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

  if (Array.isArray(rule.attributeOrder)) {
    normalized.attributeOrder = rule.attributeOrder
      .map((entry) => normalizeAttributeOrderEntry(entry, tagName, diagnostics))
      .filter(Boolean);
  }

  if (rule.unknownAttributesPosition === "top" || rule.unknownAttributesPosition === "bottom") {
    normalized.unknownAttributesPosition = rule.unknownAttributesPosition;
  }

  if (rule.sortUnknownAttributes === "preserve" || rule.sortUnknownAttributes === "alphabetical") {
    normalized.sortUnknownAttributes = rule.sortUnknownAttributes;
  }

  if (["preserve", "self-closing", "explicit"].includes(rule.closingStyle)) {
    normalized.closingStyle = rule.closingStyle;
  }

  if (["preserve", "same-line", "new-line"].includes(rule.closingBracketPosition)) {
    normalized.closingBracketPosition = rule.closingBracketPosition;
  }

  if (["preserve", "same-line", "new-line"].includes(rule.closingTagPosition)) {
    normalized.closingTagPosition = rule.closingTagPosition;
  }

  return normalized;
}

/**
 * @param {any} entry
 * @param {string} tagName
 * @param {string[]} diagnostics
 * @returns {{name: string, kinds: string[] | null} | null}
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
  normalizeConfig,
  parseJsonc,
  readWorkspaceConfig
};
