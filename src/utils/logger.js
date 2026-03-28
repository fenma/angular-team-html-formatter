"use strict";

const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 * @returns {{debug(message: string): void, warn(message: string): void, info(message: string): void, dispose(): void}}
 */
function createLogger(context) {
  const channel = vscode.window.createOutputChannel("Angular Team HTML Formatter");
  context.subscriptions.push(channel);

  function isDebugEnabled() {
    return vscode.workspace.getConfiguration("angularTeamHtmlFormatter").get("enableDebugLogs", false);
  }

  return {
    debug(message) {
      if (isDebugEnabled()) {
        channel.appendLine(`[debug] ${message}`);
      }
    },
    info(message) {
      channel.appendLine(`[info] ${message}`);
    },
    warn(message) {
      channel.appendLine(`[warn] ${message}`);
    },
    dispose() {
      channel.dispose();
    }
  };
}

module.exports = {
  createLogger
};
