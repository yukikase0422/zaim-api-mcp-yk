/**
 * 一括削除ツール
 *
 * 検索条件に合致するZaim家計簿レコードを一括で削除する。
 * 安全策として、事前の件数確認が必須。
 */

import { z } from 'zod';
import type { ToolDefinition } from '../../types/mcp.js';
import {
  SearchCriteriaSchema,
  SearchCriteria,
  isCompositeCondition,
} from '../../types/advanced-search.js';
import type { ZaimMoney } from '../../types/zaim-api.js';
import { TokenStorage } from '../../utils/token-storage.js';
import { fetchByDateRanges } from '../../utils/pagination-helper.js';
import { filterRecords } from '../../utils/search-condition-evaluator.js';

/**
 * 一括削除ツールの入力スキーマ
 */
export const BulkDeleteToolInputSchema = z.object({
  /** 検索条件（必須）- 削除対象を特定 */
  criteria: SearchCriteriaSchema,
  /** 日付範囲（必須）- ページネーション処理用 */
  dateRange: z.object({
    /** 開始日（YYYY-MM-DD形式） */
    start: z.string().describe('開始日（YYYY-MM-DD形式）'),
    /** 終了日（YYYY-MM-DD形式） */
    end: z.string().describe('終了日（YYYY-MM-DD形式）'),
  }).strict(),
  /** 期待する件数（必須・安全策） */
  expectedCount: z.number().positive().describe('削除対象の期待件数。事前にzaim_advanced_searchで確認した件数を指定'),
  /** ドライラン（オプション） */
  dryRun: z.boolean().optional().default(false).describe('trueの場合、実際の削除は行わず、対象レコードのプレビューを返す'),
}).strict();

export type BulkDeleteToolInput = z.infer<typeof BulkDeleteToolInputSchema>;

/**
 * 削除結果の詳細
 */
interface DeleteResultDetail {
  /** レコードID */
  id: number;
  /** レコードモード */
  mode: 'payment' | 'income' | 'transfer';
  /** 削除成功フラグ */
  success: boolean;
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 削除されたレコードの概要 */
  summary?: {
    date: string;
    amount: number;
    place?: string;
    name?: string;
  };
}

/**
 * 一括削除ツールの出力スキーマ
 */
export const BulkDeleteToolOutputSchema = z.object({
  /** 削除成功フラグ */
  success: z.boolean(),
  /** メッセージ */
  message: z.string(),
  /** 削除結果の詳細（各レコードの結果） */
  results: z.array(z.object({
    id: z.number(),
    mode: z.enum(['payment', 'income', 'transfer']),
    success: z.boolean(),
    error: z.string().optional(),
    summary: z.object({
      date: z.string(),
      amount: z.number(),
      place: z.string().optional(),
      name: z.string().optional(),
    }).optional(),
  })),
  /** 統計情報 */
  stats: z.object({
    /** 対象件数 */
    targetCount: z.number(),
    /** 削除成功件数 */
    successCount: z.number(),
    /** 削除失敗件数 */
    failureCount: z.number(),
    /** ドライラン実行か */
    dryRun: z.boolean(),
  }),
});

export type BulkDeleteToolOutput = z.infer<typeof BulkDeleteToolOutputSchema>;

/**
 * 一括削除ツールの定義（MCP形式）
 */
export const bulkDeleteToolDefinition: ToolDefinition = {
  name: 'zaim_bulk_delete',
  description: 'Zaim家計簿データの一括削除。検索条件に合致するレコードを一括で削除する。安全のため検索条件と件数確認が必須。削除は永続的で復元できません。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      criteria: {
        type: 'object',
        description: '検索条件（必須）。削除対象を特定するために使用。空の条件（条件なしでの全削除）は許可されません。',
        properties: {
          field: {
            type: 'string',
            description: '検索対象フィールド',
          },
          operator: {
            type: 'string',
            description: '比較演算子',
          },
          value: {
            type: 'string',
            description: '検索値',
          },
          conditions: {
            type: 'array',
            description: '複合条件の場合の条件配列',
          },
        },
      },
      dateRange: {
        type: 'object',
        description: '検索対象の日付範囲（必須）',
        properties: {
          start: {
            type: 'string',
            description: '開始日（YYYY-MM-DD形式）',
          },
          end: {
            type: 'string',
            description: '終了日（YYYY-MM-DD形式）',
          },
        },
        required: ['start', 'end'],
      },
      expectedCount: {
        type: 'number',
        description: '削除対象の期待件数。事前にzaim_advanced_searchで確認した件数を指定。実際の件数と一致しない場合はエラー。',
      },
      dryRun: {
        type: 'boolean',
        description: 'trueの場合、実際の削除は行わず、対象レコードのプレビューを返す',
        default: false,
      },
    },
    required: ['criteria', 'dateRange', 'expectedCount'],
    additionalProperties: false,
  },
};

/**
 * 検索条件が空かどうかを検証する
 *
 * @param criteria - 検索条件
 * @returns 空の場合はtrue
 */
function isEmptyCriteria(criteria: SearchCriteria): boolean {
  if (isCompositeCondition(criteria)) {
    // 複合条件の場合、conditionsが空か、全ての条件が空の場合
    if (!criteria.conditions || criteria.conditions.length === 0) {
      return true;
    }
    // 全ての子条件が空の場合も空とみなす
    return criteria.conditions.every(cond => isEmptyCriteria(cond));
  }

  // 単一条件の場合、必須フィールドが欠けている場合は空とみなす
  if (!('field' in criteria) || !('operator' in criteria)) {
    return true;
  }

  return false;
}

/**
 * APIからデータを取得する関数
 */
async function fetchMoneyRecords(
  params: Record<string, string | number | undefined>
): Promise<ZaimMoney[]> {
  const client = TokenStorage.createZaimApiClient();

  const queryParams: Record<string, string | number> = {
    mapping: 1,
  };

  if (params.start_date) {
    queryParams.start_date = params.start_date;
  }
  if (params.end_date) {
    queryParams.end_date = params.end_date;
  }
  if (params.page) {
    queryParams.page = params.page;
  }
  if (params.limit) {
    queryParams.limit = params.limit;
  }

  const response = await client.get('/v2/home/money', queryParams);

  if (!response || typeof response !== 'object' || !Array.isArray(response.money)) {
    return [];
  }

  return response.money;
}

/**
 * 一括削除ツールの実装
 *
 * @param input - 検索条件、期待件数
 * @returns 削除結果
 */
export async function bulkDeleteTool(
  input: BulkDeleteToolInput
): Promise<BulkDeleteToolOutput> {
  try {
    // 1. 空条件チェック（安全策）
    if (isEmptyCriteria(input.criteria)) {
      return {
        success: false,
        message: '安全エラー: 検索条件が空です。条件なしでの全削除は許可されていません。検索条件を指定してください。',
        results: [],
        stats: {
          targetCount: 0,
          successCount: 0,
          failureCount: 0,
          dryRun: input.dryRun,
        },
      };
    }

    // 2. 日付範囲を使用してページネーションでデータを取得
    const paginationResult = await fetchByDateRanges(
      fetchMoneyRecords,
      input.dateRange.start,
      input.dateRange.end,
      {},
      {
        delayBetweenRequests: 200,
      }
    );

    if (paginationResult.hasError) {
      return {
        success: false,
        message: `データ取得エラー: ${paginationResult.errorMessage}`,
        results: [],
        stats: {
          targetCount: 0,
          successCount: 0,
          failureCount: 0,
          dryRun: input.dryRun,
        },
      };
    }

    // 3. 検索条件でフィルタリング
    const targetRecords = filterRecords(paginationResult.records, input.criteria);
    const actualCount = targetRecords.length;

    // 4. 件数チェック（安全策）
    if (actualCount !== input.expectedCount) {
      return {
        success: false,
        message: `件数不一致エラー: 期待件数=${input.expectedCount}件、実際の対象件数=${actualCount}件。事前にzaim_advanced_searchで対象を確認してください。`,
        results: [],
        stats: {
          targetCount: actualCount,
          successCount: 0,
          failureCount: 0,
          dryRun: input.dryRun,
        },
      };
    }

    // 対象がゼロ件の場合
    if (actualCount === 0) {
      return {
        success: true,
        message: '対象レコードが見つかりませんでした。',
        results: [],
        stats: {
          targetCount: 0,
          successCount: 0,
          failureCount: 0,
          dryRun: input.dryRun,
        },
      };
    }

    // 5. ドライランの場合はプレビューを返す
    if (input.dryRun) {
      const previewResults: DeleteResultDetail[] = targetRecords.map(record => ({
        id: record.id,
        mode: record.mode,
        success: true,
        summary: {
          date: record.date,
          amount: record.amount,
          place: record.place,
          name: record.name,
        },
      }));

      return {
        success: true,
        message: `[ドライラン] ${actualCount}件のレコードが削除対象です。実際の削除は行われていません。`,
        results: previewResults,
        stats: {
          targetCount: actualCount,
          successCount: actualCount,
          failureCount: 0,
          dryRun: true,
        },
      };
    }

    // 6. 実際の削除を実行
    const client = TokenStorage.createZaimApiClient();
    const results: DeleteResultDetail[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const record of targetRecords) {
      try {
        const endpoint = `/v2/home/money/${record.mode}/${record.id}`;

        await client.delete(endpoint);

        results.push({
          id: record.id,
          mode: record.mode,
          success: true,
          summary: {
            date: record.date,
            amount: record.amount,
            place: record.place,
            name: record.name,
          },
        });
        successCount++;

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        results.push({
          id: record.id,
          mode: record.mode,
          success: false,
          error: errorMessage,
        });
        failureCount++;
      }
    }

    const message = failureCount === 0
      ? `${successCount}件のレコードを削除しました。`
      : `${successCount}件の削除に成功、${failureCount}件の削除に失敗しました。`;

    return {
      success: failureCount === 0,
      message,
      results,
      stats: {
        targetCount: actualCount,
        successCount,
        failureCount,
        dryRun: false,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    return {
      success: false,
      message: `一括削除エラー: ${errorMessage}`,
      results: [],
      stats: {
        targetCount: 0,
        successCount: 0,
        failureCount: 0,
        dryRun: input.dryRun,
      },
    };
  }
}
