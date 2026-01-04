/**
 * 高度検索ツール
 *
 * Zaim家計簿データに対して複合条件検索を実行する。
 * AND/OR条件、全フィールド検索、出力制御に対応。
 */

import { z } from 'zod';
import type { ToolDefinition } from '../../types/mcp.js';
import {
  SearchCriteriaSchema,
  OutputControlSchema,
  SearchCriteria,
  OutputControl,
} from '../../types/advanced-search.js';
import type { ZaimMoney } from '../../types/zaim-api.js';
import { TokenStorage } from '../../utils/token-storage.js';
import { fetchByDateRanges } from '../../utils/pagination-helper.js';
import { searchAndSort, formatOutput, FormattedRecord, FormatOutputResult } from '../../utils/search-condition-evaluator.js';

/**
 * 高度検索ツールの入力スキーマ
 */
export const AdvancedSearchToolInputSchema = z.object({
  /** 検索条件（オプション - 指定なしの場合は日付範囲内の全件を取得） */
  criteria: SearchCriteriaSchema.optional(),
  /** 日付範囲（必須 - ページネーション処理用） */
  dateRange: z.object({
    /** 開始日（YYYY-MM-DD形式） */
    start: z.string().describe('開始日（YYYY-MM-DD形式）'),
    /** 終了日（YYYY-MM-DD形式） */
    end: z.string().describe('終了日（YYYY-MM-DD形式）'),
  }).strict(),
  /** 出力制御（オプション） */
  output: OutputControlSchema.optional(),
  /** 最大取得件数（オプション - 省略時は条件に合致する全件を取得） */
  limit: z.number().positive().optional().describe('最大取得件数。省略時は条件に合致する全件を取得'),
}).strict();

export type AdvancedSearchToolInput = z.infer<typeof AdvancedSearchToolInputSchema>;

/**
 * 高度検索ツールの出力スキーマ
 */
export const AdvancedSearchToolOutputSchema = z.object({
  /** 検索結果のレコード */
  records: z.array(z.union([z.number(), z.record(z.unknown())])),
  /** 検索結果の件数 */
  count: z.number(),
  /** 検索結果が切り捨てられたかどうか */
  truncated: z.boolean(),
  /** 切り捨てられた件数 */
  truncatedCount: z.number(),
  /** 検索成功フラグ */
  success: z.boolean(),
  /** メッセージ */
  message: z.string(),
  /** 検索メタ情報 */
  meta: z.object({
    /** ページネーション取得したページ数 */
    pagesRetrieved: z.number(),
    /** API取得時のレコード数（フィルタリング前） */
    totalFetched: z.number(),
    /** フィルタリング後のレコード数 */
    matchedCount: z.number(),
    /** 出力制限後のレコード数 */
    outputCount: z.number(),
  }),
});

export type AdvancedSearchToolOutput = z.infer<typeof AdvancedSearchToolOutputSchema>;

/**
 * 高度検索ツールの定義（MCP形式）
 */
export const advancedSearchToolDefinition: ToolDefinition = {
  name: 'zaim_advanced_search',
  description: 'Zaim家計簿データの高度な検索。複合条件（AND/OR）、全フィールド検索、出力制御に対応。日付範囲は必須で、その範囲内のデータを自動的にページネーションして取得します。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      criteria: {
        type: 'object',
        description: '検索条件。単一条件または複合条件（AND/OR）を指定可能。省略時は日付範囲内の全件を取得。',
        properties: {
          // 単一条件の場合
          field: {
            type: 'string',
            description: '検索対象フィールド（place, name, comment, category, genre, account, id, category_id, genre_id, account_id, from_account_id, to_account_id, amount, date, mode）',
          },
          operator: {
            type: 'string',
            description: '比較演算子（文字列: equals, contains, startsWith, endsWith / 数値: equals, notEquals, greaterThan, lessThan, greaterOrEqual, lessOrEqual, between / 日付: equals, before, after, onOrBefore, onOrAfter, between）',
          },
          value: {
            type: 'string',
            description: '検索値（文字列・数値・日付に応じて指定）',
          },
          // 複合条件の場合
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
      output: {
        type: 'object',
        description: '出力制御設定',
        properties: {
          mode: {
            type: 'string',
            enum: ['id_only', 'specified', 'full'],
            description: '出力モード: id_only=IDのみ, specified=指定フィールドのみ, full=全フィールド',
          },
          fields: {
            type: 'array',
            description: 'mode=specifiedの場合に出力するフィールド配列',
          },
          maxCharsPerRecord: {
            type: 'number',
            description: '1件あたりの最大文字数',
          },
          maxTotalChars: {
            type: 'number',
            description: '全体の最大文字数',
          },
          maxRecords: {
            type: 'number',
            description: '最大出力件数',
          },
        },
      },
      limit: {
        type: 'number',
        description: '最大取得件数。省略時は条件に合致する全件を取得',
      },
    },
    required: ['dateRange'],
    additionalProperties: false,
  },
};

/**
 * APIからデータを取得する関数
 * fetchByDateRanges用のコールバック関数
 */
async function fetchMoneyRecords(
  params: Record<string, string | number | undefined>
): Promise<ZaimMoney[]> {
  const client = TokenStorage.createZaimApiClient();

  // クエリパラメータの構築
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

  // レスポンスの形式をチェック
  if (!response || typeof response !== 'object' || !Array.isArray(response.money)) {
    return [];
  }

  return response.money;
}

/**
 * 高度検索ツールの実装
 *
 * @param input - 検索条件と出力制御設定
 * @returns 検索結果
 */
export async function advancedSearchTool(
  input: AdvancedSearchToolInput
): Promise<AdvancedSearchToolOutput> {
  try {
    // 1. 日付範囲を使用してページネーションでデータを取得
    const paginationResult = await fetchByDateRanges(
      fetchMoneyRecords,
      input.dateRange.start,
      input.dateRange.end,
      {},
      {
        maxRecords: input.limit,
        delayBetweenRequests: 200,
      }
    );

    // ページネーションエラーチェック
    if (paginationResult.hasError) {
      return {
        records: [],
        count: 0,
        truncated: false,
        truncatedCount: 0,
        success: false,
        message: `データ取得エラー: ${paginationResult.errorMessage}`,
        meta: {
          pagesRetrieved: paginationResult.pagesRetrieved,
          totalFetched: paginationResult.totalRecords,
          matchedCount: 0,
          outputCount: 0,
        },
      };
    }

    const totalFetched = paginationResult.totalRecords;
    let records = paginationResult.records;

    // 2. 検索条件が指定されている場合はフィルタリング・ソート
    let matchedCount: number;
    if (input.criteria) {
      records = searchAndSort(records, input.criteria, input.output?.maxRecords);
      matchedCount = records.length;
    } else {
      // 検索条件なしの場合はソートのみ
      records = searchAndSort(
        records,
        // 全件マッチする条件（日付範囲は既にフィルタ済み）
        { field: 'date', operator: 'onOrAfter', value: '1900-01-01' },
        input.output?.maxRecords
      );
      matchedCount = records.length;
    }

    // 3. 出力フォーマット
    const outputResult = formatOutput(records, input.output);

    return {
      records: outputResult.records,
      count: outputResult.count,
      truncated: outputResult.truncated,
      truncatedCount: outputResult.truncatedCount,
      success: true,
      message: `${outputResult.count}件の記録を取得しました（全${matchedCount}件中）`,
      meta: {
        pagesRetrieved: paginationResult.pagesRetrieved,
        totalFetched,
        matchedCount,
        outputCount: outputResult.count,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';

    return {
      records: [],
      count: 0,
      truncated: false,
      truncatedCount: 0,
      success: false,
      message: `検索エラー: ${errorMessage}`,
      meta: {
        pagesRetrieved: 0,
        totalFetched: 0,
        matchedCount: 0,
        outputCount: 0,
      },
    };
  }
}
