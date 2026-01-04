/**
 * 一括更新ツール
 *
 * 検索条件に合致するZaim家計簿レコードを一括で更新する。
 * 安全策として、事前の件数確認が必須。
 */

import { z } from 'zod';
import type { ToolDefinition } from '../../types/mcp.js';
import {
  SearchCriteriaSchema,
  UpdateFieldsSchema,
  SearchCriteria,
  UpdateFields,
  StringUpdate,
  isCompositeCondition,
  SearchCondition,
  CompositeCondition,
} from '../../types/advanced-search.js';
import type { ZaimMoney } from '../../types/zaim-api.js';
import { TokenStorage } from '../../utils/token-storage.js';
import { fetchByDateRanges } from '../../utils/pagination-helper.js';
import { filterRecords } from '../../utils/search-condition-evaluator.js';

/**
 * 一括更新ツールの入力スキーマ
 */
export const BulkUpdateToolInputSchema = z.object({
  /** 検索条件（必須）- 更新対象を特定 */
  criteria: SearchCriteriaSchema,
  /** 日付範囲（必須）- ページネーション処理用 */
  dateRange: z.object({
    /** 開始日（YYYY-MM-DD形式） */
    start: z.string().describe('開始日（YYYY-MM-DD形式）'),
    /** 終了日（YYYY-MM-DD形式） */
    end: z.string().describe('終了日（YYYY-MM-DD形式）'),
  }).strict(),
  /** 更新内容（必須） */
  updates: UpdateFieldsSchema,
  /** 期待する件数（必須・安全策） */
  expectedCount: z.number().positive().describe('更新対象の期待件数。事前にzaim_advanced_searchで確認した件数を指定'),
  /** ドライラン（オプション） */
  dryRun: z.boolean().optional().default(false).describe('trueの場合、実際の更新は行わず、対象レコードと更新内容のプレビューを返す'),
}).strict();

export type BulkUpdateToolInput = z.infer<typeof BulkUpdateToolInputSchema>;

/**
 * 更新結果の詳細
 */
interface UpdateResultDetail {
  /** レコードID */
  id: number;
  /** 更新成功フラグ */
  success: boolean;
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 更新前の値（変更されたフィールドのみ） */
  before?: Record<string, unknown>;
  /** 更新後の値（変更されたフィールドのみ） */
  after?: Record<string, unknown>;
}

/**
 * 一括更新ツールの出力スキーマ
 */
export const BulkUpdateToolOutputSchema = z.object({
  /** 更新成功フラグ */
  success: z.boolean(),
  /** メッセージ */
  message: z.string(),
  /** 更新結果の詳細（各レコードの結果） */
  results: z.array(z.object({
    id: z.number(),
    success: z.boolean(),
    error: z.string().optional(),
    before: z.record(z.unknown()).optional(),
    after: z.record(z.unknown()).optional(),
  })),
  /** 統計情報 */
  stats: z.object({
    /** 対象件数 */
    targetCount: z.number(),
    /** 更新成功件数 */
    successCount: z.number(),
    /** 更新失敗件数 */
    failureCount: z.number(),
    /** ドライラン実行か */
    dryRun: z.boolean(),
  }),
});

export type BulkUpdateToolOutput = z.infer<typeof BulkUpdateToolOutputSchema>;

/**
 * 一括更新ツールの定義（MCP形式）
 */
export const bulkUpdateToolDefinition: ToolDefinition = {
  name: 'zaim_bulk_update',
  description: 'Zaim家計簿データの一括更新。検索条件に合致するレコードを一括で更新する。安全のため事前に件数確認が必須。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      criteria: {
        type: 'object',
        description: '検索条件（必須）。更新対象を特定するために使用。更新するフィールドは検索条件に含まれている必要がある。',
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
      updates: {
        type: 'object',
        description: '更新内容。文字列フィールド（place, name, comment）は完全置換または部分置換を指定可能。',
        properties: {
          category_id: {
            type: 'number',
            description: '新しいカテゴリID',
          },
          genre_id: {
            type: 'number',
            description: '新しいジャンルID',
          },
          date: {
            type: 'string',
            description: '新しい日付（YYYY-MM-DD形式）',
          },
          amount: {
            type: 'number',
            description: '新しい金額',
          },
          place: {
            type: 'object',
            description: '店舗名の更新。mode=replaceで完全置換、mode=partialで部分置換。',
            properties: {
              mode: { type: 'string', enum: ['replace', 'partial'] },
              newValue: { type: 'string', description: '新しい値（mode=replaceの場合）' },
              searchPattern: { type: 'string', description: '検索パターン（mode=partialの場合）' },
              replaceWith: { type: 'string', description: '置換文字列（mode=partialの場合）' },
            },
          },
          name: {
            type: 'object',
            description: '品目名の更新。mode=replaceで完全置換、mode=partialで部分置換。',
            properties: {
              mode: { type: 'string', enum: ['replace', 'partial'] },
              newValue: { type: 'string', description: '新しい値（mode=replaceの場合）' },
              searchPattern: { type: 'string', description: '検索パターン（mode=partialの場合）' },
              replaceWith: { type: 'string', description: '置換文字列（mode=partialの場合）' },
            },
          },
          account_id: {
            type: 'number',
            description: '新しい口座ID',
          },
          from_account_id: {
            type: 'number',
            description: '新しい振替元口座ID',
          },
          to_account_id: {
            type: 'number',
            description: '新しい振替先口座ID',
          },
          comment: {
            type: 'object',
            description: 'コメントの更新。mode=replaceで完全置換、mode=partialで部分置換。',
            properties: {
              mode: { type: 'string', enum: ['replace', 'partial'] },
              newValue: { type: 'string', description: '新しい値（mode=replaceの場合）' },
              searchPattern: { type: 'string', description: '検索パターン（mode=partialの場合）' },
              replaceWith: { type: 'string', description: '置換文字列（mode=partialの場合）' },
            },
          },
        },
      },
      expectedCount: {
        type: 'number',
        description: '更新対象の期待件数。事前にzaim_advanced_searchで確認した件数を指定。実際の件数と一致しない場合はエラー。',
      },
      dryRun: {
        type: 'boolean',
        description: 'trueの場合、実際の更新は行わず、対象レコードと更新内容のプレビューを返す',
        default: false,
      },
    },
    required: ['criteria', 'dateRange', 'updates', 'expectedCount'],
    additionalProperties: false,
  },
};

/**
 * 検索条件から指定されたフィールドの条件を検索する
 */
function findFieldInCriteria(
  criteria: SearchCriteria,
  fieldName: string
): SearchCondition | undefined {
  if (isCompositeCondition(criteria)) {
    for (const cond of criteria.conditions) {
      const found = findFieldInCriteria(cond, fieldName);
      if (found) return found;
    }
    return undefined;
  }

  // 単一条件の場合
  const condition = criteria as SearchCondition;
  if (condition.field === fieldName) {
    return condition;
  }
  return undefined;
}

/**
 * 更新フィールドが検索条件に含まれているか検証する
 *
 * @param criteria - 検索条件
 * @param updates - 更新内容
 * @returns 検証結果（エラーメッセージの配列、空の場合は検証成功）
 */
function validateUpdateFieldsInCriteria(
  criteria: SearchCriteria,
  updates: UpdateFields
): string[] {
  const errors: string[] = [];

  // 数値フィールドの検証
  const numericFields: Array<keyof UpdateFields> = [
    'category_id', 'genre_id', 'amount', 'account_id', 'from_account_id', 'to_account_id'
  ];

  for (const field of numericFields) {
    if (updates[field] !== undefined) {
      const condition = findFieldInCriteria(criteria, field);
      if (!condition) {
        errors.push(`更新フィールド「${field}」が検索条件に含まれていません。検索条件に「${field}」の条件を追加してください。`);
      }
    }
  }

  // 日付フィールドの検証
  if (updates.date !== undefined) {
    const condition = findFieldInCriteria(criteria, 'date');
    if (!condition) {
      errors.push('更新フィールド「date」が検索条件に含まれていません。検索条件に「date」の条件を追加してください。');
    }
  }

  // 文字列フィールドの検証（place, name, comment）
  const stringFields: Array<keyof UpdateFields> = ['place', 'name', 'comment'];

  for (const field of stringFields) {
    const updateValue = updates[field] as StringUpdate | undefined;
    if (updateValue !== undefined) {
      const condition = findFieldInCriteria(criteria, field);
      if (!condition) {
        errors.push(`更新フィールド「${field}」が検索条件に含まれていません。検索条件に「${field}」の条件を追加してください。`);
      }
    }
  }

  return errors;
}

/**
 * 文字列フィールドの更新値を計算する
 *
 * @param currentValue - 現在の値
 * @param update - 更新設定
 * @returns 更新後の値
 */
function applyStringUpdate(currentValue: string | undefined, update: StringUpdate): string {
  if (update.mode === 'replace') {
    return update.newValue ?? '';
  }

  // 部分置換
  if (update.mode === 'partial' && update.searchPattern !== undefined) {
    const current = currentValue ?? '';
    const replaceWith = update.replaceWith ?? '';
    return current.split(update.searchPattern).join(replaceWith);
  }

  return currentValue ?? '';
}

/**
 * レコードに対する更新内容を計算する
 *
 * @param record - 元のレコード
 * @param updates - 更新設定
 * @returns 更新用のボディオブジェクト、更新前/更新後の値
 */
function calculateUpdateBody(
  record: ZaimMoney,
  updates: UpdateFields
): { body: Record<string, string | number>; before: Record<string, unknown>; after: Record<string, unknown> } {
  const body: Record<string, string | number> = {
    mapping: 1,
  };
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  // 数値フィールド
  if (updates.category_id !== undefined) {
    before.category_id = record.category_id;
    after.category_id = updates.category_id;
    body.category_id = updates.category_id;
  }

  if (updates.genre_id !== undefined) {
    before.genre_id = record.genre_id;
    after.genre_id = updates.genre_id;
    body.genre_id = updates.genre_id;
  }

  if (updates.amount !== undefined) {
    before.amount = record.amount;
    after.amount = updates.amount;
    body.amount = updates.amount;
  }

  if (updates.account_id !== undefined) {
    before.account_id = record.from_account_id ?? record.to_account_id;
    after.account_id = updates.account_id;
    // account_idはmodeに応じてfrom_account_idまたはto_account_idに変換
    if (record.mode === 'payment') {
      body.from_account_id = updates.account_id;
    } else if (record.mode === 'income') {
      body.to_account_id = updates.account_id;
    }
  }

  if (updates.from_account_id !== undefined) {
    before.from_account_id = record.from_account_id;
    after.from_account_id = updates.from_account_id;
    body.from_account_id = updates.from_account_id;
  }

  if (updates.to_account_id !== undefined) {
    before.to_account_id = record.to_account_id;
    after.to_account_id = updates.to_account_id;
    body.to_account_id = updates.to_account_id;
  }

  // 日付フィールド
  if (updates.date !== undefined) {
    before.date = record.date;
    after.date = updates.date;
    body.date = updates.date;
  }

  // 文字列フィールド
  if (updates.place !== undefined) {
    const newValue = applyStringUpdate(record.place, updates.place);
    before.place = record.place;
    after.place = newValue;
    body.place = newValue;
  }

  if (updates.name !== undefined) {
    const newValue = applyStringUpdate(record.name, updates.name);
    before.name = record.name;
    after.name = newValue;
    body.name = newValue;
  }

  if (updates.comment !== undefined) {
    const newValue = applyStringUpdate(record.comment, updates.comment);
    before.comment = record.comment;
    after.comment = newValue;
    body.comment = newValue;
  }

  return { body, before, after };
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
 * 一括更新ツールの実装
 *
 * @param input - 検索条件、更新内容、期待件数
 * @returns 更新結果
 */
export async function bulkUpdateTool(
  input: BulkUpdateToolInput
): Promise<BulkUpdateToolOutput> {
  try {
    // 1. 更新フィールドが検索条件に含まれているか検証
    const validationErrors = validateUpdateFieldsInCriteria(input.criteria, input.updates);
    if (validationErrors.length > 0) {
      return {
        success: false,
        message: `整合性エラー: ${validationErrors.join(' ')}`,
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
      const previewResults: UpdateResultDetail[] = targetRecords.map(record => {
        const { before, after } = calculateUpdateBody(record, input.updates);
        return {
          id: record.id,
          success: true,
          before,
          after,
        };
      });

      return {
        success: true,
        message: `[ドライラン] ${actualCount}件のレコードが更新対象です。実際の更新は行われていません。`,
        results: previewResults,
        stats: {
          targetCount: actualCount,
          successCount: actualCount,
          failureCount: 0,
          dryRun: true,
        },
      };
    }

    // 6. 実際の更新を実行
    const client = TokenStorage.createZaimApiClient();
    const results: UpdateResultDetail[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const record of targetRecords) {
      try {
        const { body, before, after } = calculateUpdateBody(record, input.updates);
        const endpoint = `/v2/home/money/${record.mode}/${record.id}`;

        await client.put(endpoint, body);

        results.push({
          id: record.id,
          success: true,
          before,
          after,
        });
        successCount++;

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        results.push({
          id: record.id,
          success: false,
          error: errorMessage,
        });
        failureCount++;
      }
    }

    const message = failureCount === 0
      ? `${successCount}件のレコードを更新しました。`
      : `${successCount}件の更新に成功、${failureCount}件の更新に失敗しました。`;

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
      message: `一括更新エラー: ${errorMessage}`,
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
