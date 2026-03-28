"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const distDir = path.join(rootDir, "dist");
const outputFile = path.join(distDir, `${packageJson.name}-${packageJson.version}.vsix`);

fs.mkdirSync(distDir, { recursive: true });

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["@vscode/vsce", "package", "--allow-missing-repository", "--out", outputFile];

console.log(`Packaging VSIX to ${outputFile}`);

const result = spawnSync(command, args, {
  cwd: rootDir,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
