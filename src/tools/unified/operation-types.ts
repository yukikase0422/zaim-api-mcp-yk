/**
 * zaim_execute ツールの operation 定義
 *
 * 各operationは既存のZaimツールへの短縮形エイリアスを提供する
 */

/**
 * 利用可能なoperation名の一覧
 */
export const OPERATIONS = {
  // 認証・ユーザー情報
  CHECK_AUTH: 'check_auth',
  GET_USER: 'get_user',

  // 家計簿データ操作
  GET_MONEY: 'get_money',
  CREATE_PAYMENT: 'create_payment',
  CREATE_INCOME: 'create_income',
  CREATE_TRANSFER: 'create_transfer',
  UPDATE_MONEY: 'update_money',
  DELETE_MONEY: 'delete_money',

  // マスターデータ
  GET_CATEGORIES: 'get_categories',
  GET_GENRES: 'get_genres',
  GET_ACCOUNTS: 'get_accounts',
  GET_DEFAULT_CATEGORIES: 'get_default_categories',
  GET_DEFAULT_GENRES: 'get_default_genres',
  GET_CURRENCIES: 'get_currencies',

  // 高度検索・一括操作
  SEARCH: 'search',
  BULK_UPDATE: 'bulk_update',
  BULK_DELETE: 'bulk_delete',
} as const;

/**
 * operation名の型
 */
export type OperationName = typeof OPERATIONS[keyof typeof OPERATIONS];

/**
 * 全operationの配列（バリデーション用）
 */
export const ALL_OPERATIONS: OperationName[] = Object.values(OPERATIONS);

/**
 * operationから元のツール名へのマッピング
 */
export const OPERATION_TO_TOOL_NAME: Record<OperationName, string> = {
  [OPERATIONS.CHECK_AUTH]: 'zaim_check_auth_status',
  [OPERATIONS.GET_USER]: 'zaim_get_user_info',
  [OPERATIONS.GET_MONEY]: 'zaim_get_money_records',
  [OPERATIONS.CREATE_PAYMENT]: 'zaim_create_payment',
  [OPERATIONS.CREATE_INCOME]: 'zaim_create_income',
  [OPERATIONS.CREATE_TRANSFER]: 'zaim_create_transfer',
  [OPERATIONS.UPDATE_MONEY]: 'zaim_update_money_record',
  [OPERATIONS.DELETE_MONEY]: 'zaim_delete_money_record',
  [OPERATIONS.GET_CATEGORIES]: 'zaim_get_user_categories',
  [OPERATIONS.GET_GENRES]: 'zaim_get_user_genres',
  [OPERATIONS.GET_ACCOUNTS]: 'zaim_get_user_accounts',
  [OPERATIONS.GET_DEFAULT_CATEGORIES]: 'zaim_get_default_categories',
  [OPERATIONS.GET_DEFAULT_GENRES]: 'zaim_get_default_genres',
  [OPERATIONS.GET_CURRENCIES]: 'zaim_get_currencies',
  [OPERATIONS.SEARCH]: 'zaim_advanced_search',
  [OPERATIONS.BULK_UPDATE]: 'zaim_bulk_update',
  [OPERATIONS.BULK_DELETE]: 'zaim_bulk_delete',
};

/**
 * operationの説明
 */
export const OPERATION_DESCRIPTIONS: Record<OperationName, string> = {
  [OPERATIONS.CHECK_AUTH]: '認証状態確認',
  [OPERATIONS.GET_USER]: 'ユーザー情報取得',
  [OPERATIONS.GET_MONEY]: '家計簿データ取得',
  [OPERATIONS.CREATE_PAYMENT]: '支出作成',
  [OPERATIONS.CREATE_INCOME]: '収入作成',
  [OPERATIONS.CREATE_TRANSFER]: '振替作成',
  [OPERATIONS.UPDATE_MONEY]: 'データ更新',
  [OPERATIONS.DELETE_MONEY]: 'データ削除',
  [OPERATIONS.GET_CATEGORIES]: 'ユーザーカテゴリ取得',
  [OPERATIONS.GET_GENRES]: 'ユーザージャンル取得',
  [OPERATIONS.GET_ACCOUNTS]: 'ユーザー口座取得',
  [OPERATIONS.GET_DEFAULT_CATEGORIES]: 'システムカテゴリ取得',
  [OPERATIONS.GET_DEFAULT_GENRES]: 'システムジャンル取得',
  [OPERATIONS.GET_CURRENCIES]: '通貨一覧取得',
  [OPERATIONS.SEARCH]: '高度検索',
  [OPERATIONS.BULK_UPDATE]: '一括更新',
  [OPERATIONS.BULK_DELETE]: '一括削除',
};

/**
 * 指定された値が有効なoperationかどうかを判定
 */
export function isValidOperation(value: unknown): value is OperationName {
  return typeof value === 'string' && ALL_OPERATIONS.includes(value as OperationName);
}

/**
 * 利用可能なoperationの一覧を取得（ヘルプ表示用）
 */
export function getOperationList(): Array<{ operation: OperationName; description: string; originalTool: string }> {
  return ALL_OPERATIONS.map(op => ({
    operation: op,
    description: OPERATION_DESCRIPTIONS[op],
    originalTool: OPERATION_TO_TOOL_NAME[op],
  }));
}
