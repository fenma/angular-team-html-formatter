"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { normalizeConfig } = require("../src/config/config-reader");

function createLogger() {
  return {
    debug() {},
    warn() {}
  };
}

function createConfig(partial) {
  return normalizeConfig(partial, []);
}

function createTempWorkspace(t) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-formatter-test-"));
  t.after(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });
  return workspaceRoot;
}

module.exports = {
  createConfig,
  createLogger,
  createTempWorkspace
};
