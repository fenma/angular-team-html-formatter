"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { collectConfigDiagnostics } = require("../src/config/config-diagnostics");

test("collectConfigDiagnostics reports unsupported closing settings on void tags", () => {
  const diagnostics = collectConfigDiagnostics(`{
    "tags": {
      "input": {
        "closingStyle": "explicit",
        "closingTagPosition": "next-line",
        "closingBracketPosition": "next-line"
      }
    }
  }`);

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0].message, 'Void tag "input" cannot use "closingStyle".');
  assert.equal(diagnostics[0].severity, "error");
  assert.equal(diagnostics[1].message, 'Void tag "input" cannot use "closingTagPosition".');
  assert.equal(diagnostics[1].severity, "error");
});

test("collectConfigDiagnostics ignores allowed settings on void tags", () => {
  const diagnostics = collectConfigDiagnostics(`{
    "tags": {
      "input": {
        "closingBracketPosition": "next-line"
      }
    }
  }`);

  assert.deepEqual(diagnostics, []);
});

test("collectConfigDiagnostics ignores closing settings on non-void tags", () => {
  const diagnostics = collectConfigDiagnostics(`{
    "tags": {
      "p-select": {
        "closingStyle": "explicit",
        "closingTagPosition": "same-line"
      }
    }
  }`);

  assert.deepEqual(diagnostics, []);
});
