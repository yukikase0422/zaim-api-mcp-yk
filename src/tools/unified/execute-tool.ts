/**
 * zaim_execute ツール
 *
 * Zaim APIの全操作を統一されたインターフェースで実行する。
 * operationに操作名（短縮形）、paramsに操作固有のパラメータを指定する。
 */

import { z } from 'zod';
import type { ToolDefinition } from '../../types/mcp.js';
import { ALL_OPERATIONS, OPERATION_DESCRIPTIONS, getOperationList } from './operation-types.js';
import { executeOperation } from './operation-router.js';

/**
 * zaim_execute ツールの入力スキーマ
 */
export const ExecuteToolInputSchema = z.object({
  /** 操作タイプ（短縮形） */
  operation: z.string().describe('操作タイプ（短縮形）。例: check_auth, get_money, create_payment など'),
  /** 操作固有のパラメータ */
  params: z.record(z.unknown()).optional().describe('操作固有のパラメータ。操作によって必要なパラメータが異なります'),
}).strict();

export type ExecuteToolInput = z.infer<typeof ExecuteToolInputSchema>;

/**
 * zaim_execute ツールの出力スキーマ
 */
export const ExecuteToolOutputSchema = z.object({
  /** 実行した操作 */
  operation: z.string(),
  /** 操作の結果 */
  result: z.unknown(),
  /** 成功フラグ */
  success: z.boolean(),
  /** メッセージ */
  message: z.string(),
});

export type ExecuteToolOutput = z.infer<typeof ExecuteToolOutputSchema>;

/**
 * zaim_execute ツールの定義（MCP形式）
 */
export const executeToolDefinition: ToolDefinition = {
  name: 'zaim_execute',
  description: 'Zaim APIの操作を実行します。operationに操作名、paramsに操作固有のパラメータを指定してください。操作一覧はzaim_helpツールで確認できます。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      operation: {
        type: 'string',
        description: '操作タイプ（短縮形）。利用可能な操作: ' + ALL_OPERATIONS.join(', '),
        enum: ALL_OPERATIONS,
      },
      params: {
        type: 'object',
        description: '操作固有のパラメータ。操作によって必要なパラメータが異なります。詳細はzaim_helpで確認してください。',
        additionalProperties: true,
      },
    },
    required: ['operation'],
    additionalProperties: false,
  },
};

/**
 * zaim_execute ツールの実装
 *
 * @param input - 入力パラメータ
 * @returns 操作の結果
 */
export async function executeTool(input: ExecuteToolInput): Promise<ExecuteToolOutput> {
  const { operation, params } = input;

  // operationの存在チェック
  if (!ALL_OPERATIONS.includes(operation as typeof ALL_OPERATIONS[number])) {
    const operationList = getOperationList()
      .map((op) => `  - ${op.operation}: ${op.description}`)
      .join('\n');

    return {
      operation,
      result: null,
      success: false,
      message: `不正なoperation名: "${operation}"。\n\n利用可能な操作:\n${operationList}`,
    };
  }

  try {
    // 操作を実行
    const result = await executeOperation(operation, params);

    return {
      operation,
      result,
      success: true,
      message: `操作 "${operation}" を正常に実行しました`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      operation,
      result: null,
      success: false,
      message: `操作 "${operation}" の実行に失敗しました: ${errorMessage}`,
    };
  }
}
