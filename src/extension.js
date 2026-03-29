"use strict";

const vscode = require("vscode");
const path = require("path");
const { readWorkspaceConfig } = require("./config/config-reader");
const { collectConfigDiagnostics } = require("./config/config-diagnostics");
const { DEFAULT_CONFIG } = require("./config/default-config");
const { formatText, getIndentLevelAtEnd } = require("./formatter");
const { createLogger } = require("./utils/logger");
const { fullDocumentRange, fullLineRange } = require("./utils/text-edits");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const logger = createLogger(context);
  const configDiagnostics = vscode.languages.createDiagnosticCollection("angularTeamHtmlFormatterConfig");

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

  const refreshDocumentDiagnostics = (document) => {
    if (!isFormatterConfigDocument(document)) {
      return;
    }

    configDiagnostics.set(document.uri, buildConfigDiagnostics(document));
  };

  const clearDocumentDiagnostics = (document) => {
    if (!isFormatterConfigDocument(document)) {
      return;
    }

    configDiagnostics.delete(document.uri);
  };

  for (const document of vscode.workspace.textDocuments) {
    refreshDocumentDiagnostics(document);
  }

  const openConfigListener = vscode.workspace.onDidOpenTextDocument(refreshDocumentDiagnostics);
  const changeConfigListener = vscode.workspace.onDidChangeTextDocument((event) => {
    refreshDocumentDiagnostics(event.document);
  });
  const saveConfigListener = vscode.workspace.onDidSaveTextDocument(refreshDocumentDiagnostics);
  const closeConfigListener = vscode.workspace.onDidCloseTextDocument(clearDocumentDiagnostics);

  context.subscriptions.push(
    configDiagnostics,
    formattingProvider,
    rangeFormattingProvider,
    formatCommand,
    validateConfigCommand,
    showActiveConfigCommand,
    openConfigListener,
    changeConfigListener,
    saveConfigListener,
    closeConfigListener
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

/**
 * @param {vscode.TextDocument} document
 * @returns {boolean}
 */
function isFormatterConfigDocument(document) {
  return (
    document &&
    document.uri &&
    document.uri.scheme === "file" &&
    DEFAULT_CONFIG.configFileNames.includes(path.basename(document.uri.fsPath))
  );
}

/**
 * @param {vscode.TextDocument} document
 * @returns {vscode.Diagnostic[]}
 */
function buildConfigDiagnostics(document) {
  return collectConfigDiagnostics(document.getText()).map((diagnostic) => {
    const start = document.positionAt(diagnostic.start);
    const end = document.positionAt(Math.max(diagnostic.end, diagnostic.start + 1));
    const range = new vscode.Range(start, end);
    const severity =
      diagnostic.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;

    return new vscode.Diagnostic(range, diagnostic.message, severity);
  });
}

module.exports = {
  activate,
  deactivate
};
