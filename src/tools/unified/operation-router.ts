/**
 * zaim_execute ツールの操作ルーター
 *
 * operation名から対応するツール関数とスキーマへのルーティングを提供する
 */

import { z } from 'zod';

// 認証・ユーザー情報ツール
import {
  checkAuthStatusTool,
  CheckAuthStatusInputSchema,
  getUserInfoTool,
  GetUserInfoInputSchema,
} from '../auth/user-tools.js';

// 家計簿データ取得ツール
import {
  getMoneyRecordsTool,
  GetMoneyRecordsInputSchema,
} from '../money/money-read-tools.js';

// 家計簿データ作成ツール
import {
  createPaymentTool,
  CreatePaymentInputSchema,
  createIncomeTool,
  CreateIncomeInputSchema,
  createTransferTool,
  CreateTransferInputSchema,
} from '../money/money-write-tools.js';

// 家計簿データ更新ツール
import {
  updateMoneyRecordTool,
  UpdateMoneyRecordInputSchema,
} from '../money/money-update-tools.js';

// 家計簿データ削除ツール
import {
  deleteMoneyRecordTool,
  DeleteMoneyRecordInputSchema,
} from '../money/money-delete-tools.js';

// マスターデータ取得ツール
import {
  getUserCategoriesTool,
  GetUserCategoriesInputSchema,
  getUserGenresTool,
  GetUserGenresInputSchema,
  getUserAccountsTool,
  GetUserAccountsInputSchema,
  getDefaultCategoriesByModeTool,
  GetDefaultCategoriesByModeInputSchema,
  getDefaultGenresByModeTool,
  GetDefaultGenresByModeInputSchema,
  getCurrenciesTool,
  GetCurrenciesInputSchema,
} from '../master/master-data-tools.js';

// 高度検索・一括操作ツール
import {
  advancedSearchTool,
  AdvancedSearchToolInputSchema,
} from '../advanced/advanced-search-tool.js';

import {
  bulkUpdateTool,
  BulkUpdateToolInputSchema,
} from '../advanced/bulk-update-tool.js';

import {
  bulkDeleteTool,
  BulkDeleteToolInputSchema,
} from '../advanced/bulk-delete-tool.js';

// operation型
import { OPERATIONS, type OperationName } from './operation-types.js';

/**
 * 操作ハンドラーの型定義
 */
interface OperationHandler {
  /** ツール関数 */
  execute: (input: unknown) => Promise<unknown>;
  /** 入力バリデーションスキーマ */
  schema: z.ZodType<unknown>;
}

/**
 * operation名から対応するハンドラーへのマッピング
 */
const operationHandlers: Record<OperationName, OperationHandler> = {
  // 認証・ユーザー情報
  [OPERATIONS.CHECK_AUTH]: {
    execute: (input) => checkAuthStatusTool(CheckAuthStatusInputSchema.parse(input)),
    schema: CheckAuthStatusInputSchema,
  },
  [OPERATIONS.GET_USER]: {
    execute: (input) => getUserInfoTool(GetUserInfoInputSchema.parse(input)),
    schema: GetUserInfoInputSchema,
  },

  // 家計簿データ操作
  [OPERATIONS.GET_MONEY]: {
    execute: (input) => getMoneyRecordsTool(GetMoneyRecordsInputSchema.parse(input)),
    schema: GetMoneyRecordsInputSchema,
  },
  [OPERATIONS.CREATE_PAYMENT]: {
    execute: (input) => createPaymentTool(CreatePaymentInputSchema.parse(input)),
    schema: CreatePaymentInputSchema,
  },
  [OPERATIONS.CREATE_INCOME]: {
    execute: (input) => createIncomeTool(CreateIncomeInputSchema.parse(input)),
    schema: CreateIncomeInputSchema,
  },
  [OPERATIONS.CREATE_TRANSFER]: {
    execute: (input) => createTransferTool(CreateTransferInputSchema.parse(input)),
    schema: CreateTransferInputSchema,
  },
  [OPERATIONS.UPDATE_MONEY]: {
    execute: (input) => updateMoneyRecordTool(UpdateMoneyRecordInputSchema.parse(input)),
    schema: UpdateMoneyRecordInputSchema,
  },
  [OPERATIONS.DELETE_MONEY]: {
    execute: (input) => deleteMoneyRecordTool(DeleteMoneyRecordInputSchema.parse(input)),
    schema: DeleteMoneyRecordInputSchema,
  },

  // マスターデータ
  [OPERATIONS.GET_CATEGORIES]: {
    execute: (input) => getUserCategoriesTool(GetUserCategoriesInputSchema.parse(input)),
    schema: GetUserCategoriesInputSchema,
  },
  [OPERATIONS.GET_GENRES]: {
    execute: (input) => getUserGenresTool(GetUserGenresInputSchema.parse(input)),
    schema: GetUserGenresInputSchema,
  },
  [OPERATIONS.GET_ACCOUNTS]: {
    execute: (input) => getUserAccountsTool(GetUserAccountsInputSchema.parse(input)),
    schema: GetUserAccountsInputSchema,
  },
  [OPERATIONS.GET_DEFAULT_CATEGORIES]: {
    execute: (input) => getDefaultCategoriesByModeTool(GetDefaultCategoriesByModeInputSchema.parse(input)),
    schema: GetDefaultCategoriesByModeInputSchema,
  },
  [OPERATIONS.GET_DEFAULT_GENRES]: {
    execute: (input) => getDefaultGenresByModeTool(GetDefaultGenresByModeInputSchema.parse(input)),
    schema: GetDefaultGenresByModeInputSchema,
  },
  [OPERATIONS.GET_CURRENCIES]: {
    execute: (input) => getCurrenciesTool(GetCurrenciesInputSchema.parse(input)),
    schema: GetCurrenciesInputSchema,
  },

  // 高度検索・一括操作
  [OPERATIONS.SEARCH]: {
    execute: (input) => advancedSearchTool(AdvancedSearchToolInputSchema.parse(input)),
    schema: AdvancedSearchToolInputSchema,
  },
  [OPERATIONS.BULK_UPDATE]: {
    execute: (input) => bulkUpdateTool(BulkUpdateToolInputSchema.parse(input)),
    schema: BulkUpdateToolInputSchema,
  },
  [OPERATIONS.BULK_DELETE]: {
    execute: (input) => bulkDeleteTool(BulkDeleteToolInputSchema.parse(input)),
    schema: BulkDeleteToolInputSchema,
  },
};

/**
 * 操作ハンドラーを取得
 *
 * @param operation - operation名
 * @returns 対応するハンドラー、または見つからない場合はundefined
 */
export function getOperationHandler(operation: string): OperationHandler | undefined {
  return operationHandlers[operation as OperationName];
}

/**
 * 操作を実行
 *
 * @param operation - operation名
 * @param params - 操作のパラメータ
 * @returns 操作の結果
 * @throws 不正なoperation名やバリデーションエラーの場合
 */
export async function executeOperation(
  operation: string,
  params: unknown
): Promise<unknown> {
  const handler = getOperationHandler(operation);

  if (!handler) {
    throw new Error(
      `不正なoperation名: "${operation}"。zaim_helpでoperations一覧を確認してください。`
    );
  }

  try {
    // paramsがundefinedの場合は空オブジェクトとして扱う
    const safeParams = params ?? {};
    return await handler.execute(safeParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new Error(
        `パラメータのバリデーションエラー（operation: ${operation}）:\n${messages.join('\n')}`
      );
    }
    throw error;
  }
}

/**
 * 操作の入力スキーマを取得
 *
 * @param operation - operation名
 * @returns 対応するスキーマ、または見つからない場合はundefined
 */
export function getOperationSchema(operation: string): z.ZodType<unknown> | undefined {
  const handler = getOperationHandler(operation);
  return handler?.schema;
}
