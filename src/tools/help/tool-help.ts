/**
 * ツールヘルプ取得ツール
 *
 * 指定したツールの詳細なヘルプドキュメントを取得する。
 */

import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolDefinition } from '../../types/mcp.js';
import { getAllToolNames } from '../registry.js';

// ESモジュールで__dirnameを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ヘルプドキュメントが利用可能なツール一覧
 */
const TOOLS_WITH_HELP = [
  'zaim_advanced_search',
  'zaim_bulk_update',
  'zaim_bulk_delete',
] as const;

type ToolWithHelp = typeof TOOLS_WITH_HELP[number];

/**
 * ツールヘルプ取得ツールの入力スキーマ
 */
export const GetToolHelpInputSchema = z.object({
  /** ヘルプを取得するツール名 */
  toolName: z.string().describe('ヘルプを取得するツール名（例: zaim_advanced_search）'),
}).strict();

export type GetToolHelpInput = z.infer<typeof GetToolHelpInputSchema>;

/**
 * ツールヘルプ取得ツールの出力スキーマ
 */
export const GetToolHelpOutputSchema = z.object({
  /** 成功フラグ */
  success: z.boolean(),
  /** ツール名 */
  toolName: z.string(),
  /** ヘルプドキュメント（Markdown形式） */
  help: z.string().optional(),
  /** エラーメッセージ */
  error: z.string().optional(),
  /** ヘルプが利用可能なツール一覧 */
  availableTools: z.array(z.string()),
});

export type GetToolHelpOutput = z.infer<typeof GetToolHelpOutputSchema>;

/**
 * ツールヘルプ取得ツールの定義（MCP形式）
 */
export const getToolHelpToolDefinition: ToolDefinition = {
  name: 'zaim_get_tool_help',
  description: 'Zaimツールの詳細なヘルプドキュメントを取得。使用例、パラメータ説明、注意点、関連ツールとの連携方法を確認できます。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      toolName: {
        type: 'string',
        description: 'ヘルプを取得するツール名。利用可能なツール: zaim_advanced_search, zaim_bulk_update, zaim_bulk_delete',
      },
    },
    required: ['toolName'],
    additionalProperties: false,
  },
};

/**
 * ツール名からヘルプファイル名を取得
 */
function getHelpFileName(toolName: string): string {
  // zaim_advanced_search -> zaim_advanced_search.md
  return `${toolName}.md`;
}

/**
 * ヘルプドキュメントのディレクトリパスを取得
 */
function getHelpDocsDir(): string {
  // src/tools/help/tool-help.ts から docs/tools/ へのパス
  // プロジェクトルートからの相対パスを使用
  return path.resolve(__dirname, '..', '..', '..', 'docs', 'tools');
}

/**
 * ツールヘルプ取得ツールの実装
 *
 * @param input - ツール名
 * @returns ヘルプドキュメント
 */
export async function getToolHelpTool(
  input: GetToolHelpInput
): Promise<GetToolHelpOutput> {
  const { toolName } = input;
  const availableTools = [...TOOLS_WITH_HELP];

  // ツール名の正規化（zaim_プレフィックスがない場合は追加）
  const normalizedToolName = toolName.startsWith('zaim_')
    ? toolName
    : `zaim_${toolName}`;

  // ヘルプが利用可能かチェック
  if (!TOOLS_WITH_HELP.includes(normalizedToolName as ToolWithHelp)) {
    // 登録されているツールかどうかをチェック
    const allToolNames = getAllToolNames();
    if (allToolNames.includes(normalizedToolName)) {
      return {
        success: false,
        toolName: normalizedToolName,
        error: `ツール「${normalizedToolName}」のヘルプドキュメントはまだ作成されていません。基本的な説明はツール定義のdescriptionを参照してください。`,
        availableTools,
      };
    }

    return {
      success: false,
      toolName: normalizedToolName,
      error: `ツール「${normalizedToolName}」は存在しません。利用可能なツールを確認してください。`,
      availableTools,
    };
  }

  // ヘルプファイルを読み込み
  const helpFileName = getHelpFileName(normalizedToolName);
  const helpFilePath = path.join(getHelpDocsDir(), helpFileName);

  try {
    const helpContent = await fs.readFile(helpFilePath, 'utf-8');

    return {
      success: true,
      toolName: normalizedToolName,
      help: helpContent,
      availableTools,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';

    return {
      success: false,
      toolName: normalizedToolName,
      error: `ヘルプファイルの読み込みに失敗しました: ${errorMessage}`,
      availableTools,
    };
  }
}
