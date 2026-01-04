import { ToolDefinition } from '../types/mcp.js';

// ヘルプツール
import {
  helpToolDefinition
} from './help/help-tool.js';

// 統合ツール
import {
  executeToolDefinition
} from './unified/execute-tool.js';

export const registeredTools: ToolDefinition[] = [
  // ヘルプ
  helpToolDefinition,

  // 統合ツール
  executeToolDefinition
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return registeredTools.find(tool => tool.name === name);
}

export function getAllToolNames(): string[] {
  return registeredTools.map(tool => tool.name);
}

export function getRegistryStats() {
  return {
    totalTools: registeredTools.length,
    toolNames: getAllToolNames()
  };
}
