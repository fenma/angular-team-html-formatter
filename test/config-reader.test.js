"use strict";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { findConfigFile, normalizeConfig, parseJsonc } = require("../src/config/config-reader");
const { createTempWorkspace } = require("../test-support/helpers");

test("normalizeConfig ignores legacy multiline attributeLayout value", () => {
  const config = normalizeConfig(
    {
      knownTagDefaults: {
        attributeLayout: "multiline"
      }
    },
    []
  );

  assert.equal(config.knownTagDefaults.attributeLayout, "preserve");
});

test("parseJsonc supports inline comments after properties", () => {
  const parsed = parseJsonc(`{
    "indent": {
      "size": 4,
      "useTabs": false
    },
    "knownTagDefaults": {
      "attributeLayout": "single-line",
      "maxAttributeLineWidth": 80,
      "unknownAttributesPosition": "last", // first | last
      "sortUnknownAttributes": "preserve", // preserve | alphabetical
      "closingStyle": "explicit" // preserve | self-closing | explicit
    }
  }`);

  const config = normalizeConfig(parsed, []);
  assert.equal(config.indent.size, 4);
  assert.equal(config.knownTagDefaults.attributeLayout, "single-line");
  assert.equal(config.knownTagDefaults.maxAttributeLineWidth, 80);
  assert.equal(config.knownTagDefaults.closingStyle, "explicit");
});

test("findConfigFile prefers the nearest config between document folder and workspace root", (t) => {
  const workspaceRoot = createTempWorkspace(t);
  const appRoot = path.join(workspaceRoot, "apps", "admin");
  const srcRoot = path.join(appRoot, "src");
  fs.mkdirSync(srcRoot, { recursive: true });

  const workspaceConfigPath = path.join(workspaceRoot, "html-formatter.config.jsonc");
  const nestedConfigPath = path.join(appRoot, "html-formatter.config.jsonc");
  fs.writeFileSync(workspaceConfigPath, "{\n  \"indent\": { \"size\": 2 }\n}\n");
  fs.writeFileSync(nestedConfigPath, "{\n  \"indent\": { \"size\": 4 }\n}\n");

  assert.equal(findConfigFile(workspaceRoot, srcRoot), nestedConfigPath);
});

test("findConfigFile falls back to workspace root when no nested config exists", (t) => {
  const workspaceRoot = createTempWorkspace(t);
  const srcRoot = path.join(workspaceRoot, "apps", "admin", "src");
  fs.mkdirSync(srcRoot, { recursive: true });

  const workspaceConfigPath = path.join(workspaceRoot, "html-formatter.config.jsonc");
  fs.writeFileSync(workspaceConfigPath, "{\n  \"indent\": { \"size\": 2 }\n}\n");

  assert.equal(findConfigFile(workspaceRoot, srcRoot), workspaceConfigPath);
});

test("normalizeConfig ignores closing settings that do not apply to void tags", () => {
  const diagnostics = [];
  const config = normalizeConfig(
    {
      tags: {
        input: {
          closingStyle: "explicit",
          closingBracketPosition: "new-line",
          closingTagPosition: "new-line"
        }
      }
    },
    diagnostics
  );

  assert.equal(config.tags.input.closingStyle, undefined);
  assert.equal(config.tags.input.closingBracketPosition, "new-line");
  assert.equal(config.tags.input.closingTagPosition, undefined);
  assert.deepEqual(diagnostics, [
    'Ignoring closingStyle on void tag "input". Void tags cannot use closingStyle.',
    'Ignoring closingTagPosition on void tag "input". Void tags do not have end tags.'
  ]);
});
