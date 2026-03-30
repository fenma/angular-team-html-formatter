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
  assert.equal(diagnostics[0].message, 'Tag "input" cannot use "closingStyle". Standard HTML tags cannot use closingStyle.');
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

test("collectConfigDiagnostics ignores closing settings on custom component tags", () => {
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

test("collectConfigDiagnostics reports closingStyle on non-void standard HTML tags", () => {
  const diagnostics = collectConfigDiagnostics(`{
    "tags": {
      "div": {
        "closingStyle": "explicit"
      }
    }
  }`);

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0].message,
    'Tag "div" cannot use "closingStyle". Standard HTML tags cannot use closingStyle.'
  );
  assert.equal(diagnostics[0].severity, "error");
});

test("collectConfigDiagnostics reports closingTagPosition when closingStyle is self-closing", () => {
  const diagnostics = collectConfigDiagnostics(`{
    "tags": {
      "p-select": {
        "closingStyle": "self-closing",
        "closingTagPosition": "next-line"
      }
    }
  }`);

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0].message,
    'Tag "p-select" cannot use "closingTagPosition" when "closingStyle" is "self-closing".'
  );
  assert.equal(diagnostics[0].severity, "error");
});
