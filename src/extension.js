"use strict";

const vscode = require("vscode");
const { readWorkspaceConfig } = require("./config/config-reader");
const { formatText, getIndentLevelAtEnd } = require("./formatter");
const { createLogger } = require("./utils/logger");
const { fullDocumentRange, fullLineRange } = require("./utils/text-edits");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const logger = createLogger(context);

  const documentSelector = [
    { language: "html", scheme: "file" },
    { scheme: "file", pattern: "**/*.html" }
  ];

  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(documentSelector, {
    provideDocumentFormattingEdits(document) {
      return buildFullDocumentEdit(document, logger);
    }
  });

  const rangeFormattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(documentSelector, {
    provideDocumentRangeFormattingEdits(document, range) {
      return buildRangeEdit(document, range, logger);
    }
  });

  const formatCommand = vscode.commands.registerCommand("angularTeamHtmlFormatter.formatDocument", async () => {
    await vscode.commands.executeCommand("editor.action.formatDocument");
  });

  const validateConfigCommand = vscode.commands.registerCommand(
    "angularTeamHtmlFormatter.validateConfig",
    async () => {
      const editor = vscode.window.activeTextEditor;
      const result = readWorkspaceConfig(editor && editor.document, logger);

      if (result.diagnostics.length) {
        const message = result.diagnostics.join("\n");
        vscode.window.showWarningMessage(message);
        return;
      }

      vscode.window.showInformationMessage(
        result.filePath ? `Formatter config is valid: ${result.filePath}` : "No formatter config found."
      );
    }
  );

  const showActiveConfigCommand = vscode.commands.registerCommand(
    "angularTeamHtmlFormatter.showActiveConfig",
    async () => {
      const editor = vscode.window.activeTextEditor;
      const result = readWorkspaceConfig(editor && editor.document, logger);
      const document = await vscode.workspace.openTextDocument({
        content: JSON.stringify(
          {
            configFilePath: result.filePath,
            diagnostics: result.diagnostics,
            config: result.config
          },
          null,
          2
        ),
        language: "json"
      });
      await vscode.window.showTextDocument(document, { preview: false });
    }
  );

  context.subscriptions.push(
    formattingProvider,
    rangeFormattingProvider,
    formatCommand,
    validateConfigCommand,
    showActiveConfigCommand
  );
}

function deactivate() {}

/**
 * @param {vscode.TextDocument} document
 * @param {{debug(message: string): void, warn(message: string): void}} logger
 * @returns {vscode.TextEdit[]}
 */
function buildFullDocumentEdit(document, logger) {
  const { config, diagnostics } = readWorkspaceConfig(document, logger);
  if (diagnostics.length) {
    logger.warn(diagnostics.join(" | "));
  }

  const original = document.getText();
  const formatted = formatText(original, config, logger);
  if (formatted === original) {
    return [];
  }

  return [vscode.TextEdit.replace(fullDocumentRange(document, original), formatted)];
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Range} range
 * @param {{debug(message: string): void, warn(message: string): void}} logger
 * @returns {vscode.TextEdit[]}
 */
function buildRangeEdit(document, range, logger) {
  const { config, diagnostics } = readWorkspaceConfig(document, logger);
  if (diagnostics.length) {
    logger.warn(diagnostics.join(" | "));
  }

  const expandedRange = fullLineRange(document, range);
  const original = document.getText(expandedRange);
  const prefixRange = new vscode.Range(0, 0, expandedRange.start.line, 0);
  const textBeforeSelection = document.getText(prefixRange);
  const initialIndentLevel = getIndentLevelAtEnd(textBeforeSelection);
  const formatted = formatText(original, config, logger, { initialIndentLevel });
  if (formatted === original) {
    return [];
  }

  return [vscode.TextEdit.replace(expandedRange, formatted)];
}

module.exports = {
  activate,
  deactivate
};
