"use strict";

const vscode = require("vscode");

/**
 * @param {vscode.TextDocument} document
 * @param {string} text
 * @returns {vscode.Range}
 */
function fullDocumentRange(document, text) {
  const lastLine = document.lineCount > 0 ? document.lineAt(document.lineCount - 1) : { lineNumber: 0, text: "" };
  return new vscode.Range(0, 0, lastLine.lineNumber, lastLine.text.length);
}

/**
 * Expands a range to full lines so selection formatting works with stable indentation context.
 *
 * @param {vscode.TextDocument} document
 * @param {vscode.Range} range
 * @returns {vscode.Range}
 */
function fullLineRange(document, range) {
  const startLine = range.start.line;
  const endLine = range.end.character === 0 && range.end.line > startLine ? range.end.line - 1 : range.end.line;
  const safeEndLine = Math.max(startLine, endLine);
  const endLineText = document.lineAt(safeEndLine);
  return new vscode.Range(startLine, 0, safeEndLine, endLineText.text.length);
}

module.exports = {
  fullDocumentRange,
  fullLineRange
};
