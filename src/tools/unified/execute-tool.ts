/**
 * zaim_execute ツール
 *
 * Zaim APIの全操作を統一されたインターフェースで実行する。
 * operationに操作名（短縮形）、paramsに操作固有のパラメータを指定する。
 * batchを指定すると複数の操作を順次実行し、結果を集約して返す。
 */

import { z } from 'zod';
import type { ToolDefinition } from '../../types/mcp.js';
import { ALL_OPERATIONS, OPERATION_DESCRIPTIONS, getOperationList } from './operation-types.js';
import { executeOperation } from './operation-router.js';

/**
 * バッチ操作の単一アイテムのスキーマ
 */
const BatchItemSchema = z.object({
  /** 操作タイプ（短縮形） */
  operation: z.string().describe('操作タイプ（短縮形）。例: check_auth, get_money, create_payment など'),
  /** 操作固有のパラメータ */
  params: z.record(z.unknown()).optional().describe('操作固有のパラメータ。操作によって必要なパラメータが異なります'),
});

export type BatchItem = z.infer<typeof BatchItemSchema>;

/**
 * zaim_execute ツールの入力スキーマ
 * 単一実行（operation指定）またはバッチ実行（batch指定）のどちらかを使用
 */
export const ExecuteToolInputSchema = z.object({
  /** 操作タイプ（短縮形）- 単一実行時に使用 */
  operation: z.string().optional().describe('操作タイプ（短縮形）。例: check_auth, get_money, create_payment など。batchを使用する場合は不要'),
  /** 操作固有のパラメータ - 単一実行時に使用 */
  params: z.record(z.unknown()).optional().describe('操作固有のパラメータ。操作によって必要なパラメータが異なります'),
  /** バッチ実行用の操作配列 */
  batch: z.array(BatchItemSchema).optional().describe('複数の操作を順次実行する場合に使用。各要素にoperation（必須）とparams（任意）を指定'),
}).strict().refine(
  (data) => {
    // operationかbatchのどちらか一方が指定されていること
    const hasOperation = data.operation !== undefined && data.operation !== '';
    const hasBatch = data.batch !== undefined && data.batch.length > 0;
    return (hasOperation && !hasBatch) || (!hasOperation && hasBatch);
  },
  {
    message: 'operationまたはbatchのどちらか一方を指定してください。両方同時、または両方未指定は不可です。',
  }
);

export type ExecuteToolInput = z.infer<typeof ExecuteToolInputSchema>;

/**
 * 単一実行の出力スキーマ
 */
export const SingleExecuteOutputSchema = z.object({
  /** 実行した操作 */
  operation: z.string(),
  /** 操作の結果 */
  result: z.unknown(),
  /** 成功フラグ */
  success: z.boolean(),
  /** メッセージ */
  message: z.string(),
});

export type SingleExecuteOutput = z.infer<typeof SingleExecuteOutputSchema>;

/**
 * バッチ実行の各結果スキーマ
 */
export const BatchResultItemSchema = z.object({
  /** 実行順（0-indexed） */
  index: z.number(),
  /** 実行した操作 */
  operation: z.string(),
  /** 操作の結果 */
  result: z.unknown(),
  /** 成功フラグ */
  success: z.boolean(),
  /** メッセージ */
  message: z.string(),
});

export type BatchResultItem = z.infer<typeof BatchResultItemSchema>;

/**
 * バッチ実行のサマリースキーマ
 */
export const BatchSummarySchema = z.object({
  /** 総実行数 */
  total: z.number(),
  /** 成功数 */
  success: z.number(),
  /** 失敗数 */
  failed: z.number(),
});

export type BatchSummary = z.infer<typeof BatchSummarySchema>;

/**
 * バッチ実行の出力スキーマ
 */
export const BatchExecuteOutputSchema = z.object({
  /** 各操作の結果 */
  results: z.array(BatchResultItemSchema),
  /** サマリー情報 */
  summary: BatchSummarySchema,
  /** 成功フラグ（全操作が成功した場合のみtrue） */
  success: z.boolean(),
  /** メッセージ */
  message: z.string(),
});

export type BatchExecuteOutput = z.infer<typeof BatchExecuteOutputSchema>;

/**
 * zaim_execute ツールの出力スキーマ（単一またはバッチ）
 */
export const ExecuteToolOutputSchema = z.union([SingleExecuteOutputSchema, BatchExecuteOutputSchema]);

export type ExecuteToolOutput = SingleExecuteOutput | BatchExecuteOutput;

/**
 * zaim_execute ツールの定義（MCP形式）
 */
export const executeToolDefinition: ToolDefinition = {
  name: 'zaim_execute',
  description: 'Zaim APIの操作を実行します。operationに操作名、paramsに操作固有のパラメータを指定するか、batchで複数の操作を一括実行できます。操作一覧はzaim_helpツールで確認できます。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      operation: {
        type: 'string',
        description: '操作タイプ（短縮形）。利用可能な操作: ' + ALL_OPERATIONS.join(', ') + '。batchを使用する場合は不要',
        enum: ALL_OPERATIONS,
      },
      params: {
        type: 'object',
        description: '操作固有のパラメータ。操作によって必要なパラメータが異なります。詳細はzaim_helpで確認してください。',
        additionalProperties: true,
      },
      batch: {
        type: 'array',
        description: '複数の操作を順次実行する場合に使用。各要素にoperationとparamsを指定。operationと同時使用不可',
        items: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: '操作タイプ（短縮形）',
              enum: ALL_OPERATIONS,
            },
            params: {
              type: 'object',
              description: '操作固有のパラメータ',
              additionalProperties: true,
            },
          },
          required: ['operation'],
        },
      },
    },
    additionalProperties: false,
  },
};

/**
 * 単一操作を実行する内部関数
 *
 * @param operation - 操作名
 * @param params - パラメータ
 * @returns 操作の結果
 */
async function executeSingleOperation(
  operation: string,
  params: Record<string, unknown> | undefined
): Promise<SingleExecuteOutput> {
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

/**
 * バッチ操作を実行する内部関数
 *
 * @param batch - バッチ操作の配列
 * @returns バッチ実行の結果
 */
async function executeBatchOperations(batch: BatchItem[]): Promise<BatchExecuteOutput> {
  const results: BatchResultItem[] = [];
  let successCount = 0;
  let failedCount = 0;

  // 各操作を順次実行
  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    const singleResult = await executeSingleOperation(item.operation, item.params);

    results.push({
      index: i,
      operation: singleResult.operation,
      result: singleResult.result,
      success: singleResult.success,
      message: singleResult.message,
    });

    if (singleResult.success) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  const allSuccess = failedCount === 0;

  return {
    results,
    summary: {
      total: batch.length,
      success: successCount,
      failed: failedCount,
    },
    success: allSuccess,
    message: allSuccess
      ? `バッチ処理完了: ${successCount}件すべて成功`
      : `バッチ処理完了: ${successCount}件成功, ${failedCount}件失敗`,
  };
}

/**
 * zaim_execute ツールの実装
 *
 * @param input - 入力パラメータ
 * @returns 操作の結果（単一実行またはバッチ実行）
 */
export async function executeTool(input: ExecuteToolInput): Promise<ExecuteToolOutput> {
  const { operation, params, batch } = input;

  // バッチ実行の場合
  if (batch && batch.length > 0) {
    return executeBatchOperations(batch);
  }

  // 単一実行の場合
  if (operation) {
    return executeSingleOperation(operation, params);
  }

  // どちらも指定されていない場合（Zodのrefineで通常はここに来ない）
  return {
    operation: '',
    result: null,
    success: false,
    message: 'operationまたはbatchのどちらかを指定してください。',
  };
}
