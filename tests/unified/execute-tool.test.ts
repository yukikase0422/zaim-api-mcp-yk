import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeTool,
  executeToolDefinition,
  ExecuteToolInputSchema,
  type ExecuteToolInput
} from '../../src/tools/unified/execute-tool.js';
import {
  OPERATIONS,
  ALL_OPERATIONS,
  OPERATION_DESCRIPTIONS,
  isValidOperation,
  getOperationList
} from '../../src/tools/unified/operation-types.js';
import {
  getOperationHandler,
  executeOperation,
  getOperationSchema
} from '../../src/tools/unified/operation-router.js';

// 各ツールのモック
vi.mock('../../src/tools/auth/user-tools.js', () => ({
  checkAuthStatusTool: vi.fn().mockResolvedValue({
    isAuthenticated: true,
    user: { id: 1, login: 'test', name: 'Test User' },
    message: '認証に成功しました'
  }),
  CheckAuthStatusInputSchema: { parse: vi.fn((input) => input) },
  getUserInfoTool: vi.fn().mockResolvedValue({
    user: { id: 1, name: 'Test User' },
    success: true,
    message: 'ユーザー情報を取得しました'
  }),
  GetUserInfoInputSchema: { parse: vi.fn((input) => input) }
}));

vi.mock('../../src/tools/money/money-read-tools.js', () => ({
  getMoneyRecordsTool: vi.fn().mockResolvedValue({
    records: [],
    count: 0,
    success: true,
    message: '0件の記録を取得しました'
  }),
  GetMoneyRecordsInputSchema: { parse: vi.fn((input) => input) }
}));

vi.mock('../../src/tools/money/money-write-tools.js', () => ({
  createPaymentTool: vi.fn().mockResolvedValue({
    record: { id: 1 },
    success: true,
    message: '支出記録を作成しました'
  }),
  CreatePaymentInputSchema: { parse: vi.fn((input) => input) },
  createIncomeTool: vi.fn().mockResolvedValue({
    record: { id: 2 },
    success: true,
    message: '収入記録を作成しました'
  }),
  CreateIncomeInputSchema: { parse: vi.fn((input) => input) },
  createTransferTool: vi.fn().mockResolvedValue({
    record: { id: 3 },
    success: true,
    message: '振替記録を作成しました'
  }),
  CreateTransferInputSchema: { parse: vi.fn((input) => input) }
}));

vi.mock('../../src/tools/money/money-update-tools.js', () => ({
  updateMoneyRecordTool: vi.fn().mockResolvedValue({
    record: { id: 1 },
    success: true,
    message: '記録を更新しました'
  }),
  UpdateMoneyRecordInputSchema: { parse: vi.fn((input) => input) }
}));

vi.mock('../../src/tools/money/money-delete-tools.js', () => ({
  deleteMoneyRecordTool: vi.fn().mockResolvedValue({
    deleted_record: { id: 1 },
    success: true,
    message: '記録を削除しました'
  }),
  DeleteMoneyRecordInputSchema: { parse: vi.fn((input) => input) }
}));

vi.mock('../../src/tools/master/master-data-tools.js', () => ({
  getUserCategoriesTool: vi.fn().mockResolvedValue({
    categories: [],
    count: 0,
    success: true,
    message: '0件のカテゴリを取得しました'
  }),
  GetUserCategoriesInputSchema: { parse: vi.fn((input) => input) },
  getUserGenresTool: vi.fn().mockResolvedValue({
    genres: [],
    count: 0,
    success: true,
    message: '0件のジャンルを取得しました'
  }),
  GetUserGenresInputSchema: { parse: vi.fn((input) => input) },
  getUserAccountsTool: vi.fn().mockResolvedValue({
    accounts: [],
    count: 0,
    success: true,
    message: '0件の口座を取得しました'
  }),
  GetUserAccountsInputSchema: { parse: vi.fn((input) => input) },
  getDefaultCategoriesByModeTool: vi.fn().mockResolvedValue({
    categories: [],
    count: 0,
    success: true,
    message: '0件のデフォルトカテゴリを取得しました'
  }),
  GetDefaultCategoriesByModeInputSchema: { parse: vi.fn((input) => input) },
  getDefaultGenresByModeTool: vi.fn().mockResolvedValue({
    genres: [],
    count: 0,
    success: true,
    message: '0件のデフォルトジャンルを取得しました'
  }),
  GetDefaultGenresByModeInputSchema: { parse: vi.fn((input) => input) },
  getCurrenciesTool: vi.fn().mockResolvedValue({
    currencies: [],
    count: 0,
    success: true,
    message: '0件の通貨を取得しました'
  }),
  GetCurrenciesInputSchema: { parse: vi.fn((input) => input) }
}));

vi.mock('../../src/tools/advanced/advanced-search-tool.js', () => ({
  advancedSearchTool: vi.fn().mockResolvedValue({
    records: [],
    count: 0,
    truncated: false,
    truncatedCount: 0,
    success: true,
    message: '0件の結果を取得しました',
    meta: { pagesRetrieved: 1, totalFetched: 0, matchedCount: 0, outputCount: 0 }
  }),
  AdvancedSearchToolInputSchema: { parse: vi.fn((input) => input) }
}));

vi.mock('../../src/tools/advanced/bulk-update-tool.js', () => ({
  bulkUpdateTool: vi.fn().mockResolvedValue({
    success: true,
    message: '0件の記録を更新しました',
    results: [],
    stats: { targetCount: 0, successCount: 0, failureCount: 0, dryRun: false }
  }),
  BulkUpdateToolInputSchema: { parse: vi.fn((input) => input) }
}));

vi.mock('../../src/tools/advanced/bulk-delete-tool.js', () => ({
  bulkDeleteTool: vi.fn().mockResolvedValue({
    success: true,
    message: '0件の記録を削除しました',
    results: [],
    stats: { targetCount: 0, successCount: 0, failureCount: 0, dryRun: false }
  }),
  BulkDeleteToolInputSchema: { parse: vi.fn((input) => input) }
}));

describe('zaim_execute Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeToolDefinition', () => {
    it('ツール定義が正しい名前を持つ', () => {
      expect(executeToolDefinition.name).toBe('zaim_execute');
    });

    it('ツール定義が正しいdescriptionを持つ', () => {
      expect(executeToolDefinition.description).toContain('Zaim API');
      expect(executeToolDefinition.description).toContain('zaim_help');
    });

    it('入力スキーマがoperationパラメータを含む', () => {
      expect(executeToolDefinition.inputSchema.properties).toHaveProperty('operation');
    });

    it('入力スキーマがparamsパラメータを含む', () => {
      expect(executeToolDefinition.inputSchema.properties).toHaveProperty('params');
    });

    it('operationまたはbatchのどちらかが必要（requiredはなし）', () => {
      expect(executeToolDefinition.inputSchema.required).toBeUndefined();
    });

    it('paramsはオプショナルパラメータである', () => {
      expect(executeToolDefinition.inputSchema.required).toBeUndefined();
    });
  });

  describe('ExecuteToolInputSchema', () => {
    it('operationのみの入力を受け付ける', () => {
      const result = ExecuteToolInputSchema.safeParse({ operation: 'check_auth' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.operation).toBe('check_auth');
        expect(result.data.params).toBeUndefined();
      }
    });

    it('operationとparamsの入力を受け付ける', () => {
      const result = ExecuteToolInputSchema.safeParse({
        operation: 'get_money',
        params: { limit: 10 }
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.operation).toBe('get_money');
        expect(result.data.params).toEqual({ limit: 10 });
      }
    });

    it('operationなしの入力を拒否する', () => {
      const result = ExecuteToolInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('unknownプロパティを拒否する', () => {
      const result = ExecuteToolInputSchema.safeParse({
        operation: 'check_auth',
        unknown: 'value'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('operation-types', () => {
    it('17個のoperationが定義されている', () => {
      expect(ALL_OPERATIONS.length).toBe(17);
    });

    it('すべてのoperationに説明がある', () => {
      for (const op of ALL_OPERATIONS) {
        expect(OPERATION_DESCRIPTIONS[op]).toBeDefined();
        expect(typeof OPERATION_DESCRIPTIONS[op]).toBe('string');
        expect(OPERATION_DESCRIPTIONS[op].length).toBeGreaterThan(0);
      }
    });

    it('isValidOperationが有効なoperationを検証する', () => {
      expect(isValidOperation('check_auth')).toBe(true);
      expect(isValidOperation('get_money')).toBe(true);
      expect(isValidOperation('search')).toBe(true);
    });

    it('isValidOperationが無効なoperationを拒否する', () => {
      expect(isValidOperation('invalid_operation')).toBe(false);
      expect(isValidOperation('')).toBe(false);
      expect(isValidOperation(123)).toBe(false);
      expect(isValidOperation(null)).toBe(false);
    });

    it('getOperationListが正しい構造を返す', () => {
      const list = getOperationList();
      expect(list.length).toBe(17);
      for (const item of list) {
        expect(item).toHaveProperty('operation');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('originalTool');
      }
    });
  });

  describe('operation-router', () => {
    it('すべてのoperationにハンドラーがある', () => {
      for (const op of ALL_OPERATIONS) {
        const handler = getOperationHandler(op);
        expect(handler).toBeDefined();
        expect(handler?.execute).toBeDefined();
        expect(handler?.schema).toBeDefined();
      }
    });

    it('無効なoperationにはハンドラーがない', () => {
      expect(getOperationHandler('invalid')).toBeUndefined();
    });

    it('getOperationSchemaがスキーマを返す', () => {
      const schema = getOperationSchema('check_auth');
      expect(schema).toBeDefined();
    });
  });

  describe('executeTool - 正常系', () => {
    it('check_auth operationを実行できる', async () => {
      const result = await executeTool({ operation: 'check_auth' });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('check_auth');
      expect(result.result).toBeDefined();
    });

    it('get_user operationを実行できる', async () => {
      const result = await executeTool({ operation: 'get_user' });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('get_user');
    });

    it('get_money operationを実行できる', async () => {
      const result = await executeTool({ operation: 'get_money' });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('get_money');
    });

    it('create_payment operationをパラメータ付きで実行できる', async () => {
      const result = await executeTool({
        operation: 'create_payment',
        params: {
          amount: 1000,
          date: '2024-01-01',
          category_id: 1,
          genre_id: 1
        }
      });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('create_payment');
    });

    it('get_categories operationを実行できる', async () => {
      const result = await executeTool({ operation: 'get_categories' });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('get_categories');
    });

    it('search operationを実行できる', async () => {
      const result = await executeTool({
        operation: 'search',
        params: {
          dateRange: { start: '2024-01-01', end: '2024-12-31' }
        }
      });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('search');
    });
  });

  describe('executeTool - エラー系', () => {
    it('無効なoperation名でエラーを返す', async () => {
      const result = await executeTool({ operation: 'invalid_operation' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('不正なoperation名');
      expect(result.message).toContain('invalid_operation');
    });

    it('エラー時に利用可能なoperationリストを返す', async () => {
      const result = await executeTool({ operation: 'not_exist' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('check_auth');
      expect(result.message).toContain('get_money');
    });
  });

  describe('executeTool - すべてのoperationをテスト', () => {
    const testCases = [
      { operation: 'check_auth', params: undefined },
      { operation: 'get_user', params: undefined },
      { operation: 'get_money', params: undefined },
      { operation: 'create_payment', params: { amount: 1000, date: '2024-01-01', category_id: 1, genre_id: 1 } },
      { operation: 'create_income', params: { amount: 1000, date: '2024-01-01', category_id: 1 } },
      { operation: 'create_transfer', params: { amount: 1000, date: '2024-01-01', from_account_id: 1, to_account_id: 2 } },
      { operation: 'update_money', params: { id: 1, mode: 'payment' } },
      { operation: 'delete_money', params: { id: 1, mode: 'payment' } },
      { operation: 'get_categories', params: undefined },
      { operation: 'get_genres', params: undefined },
      { operation: 'get_accounts', params: undefined },
      { operation: 'get_default_categories', params: { mode: 'payment' } },
      { operation: 'get_default_genres', params: { mode: 'payment' } },
      { operation: 'get_currencies', params: undefined },
      { operation: 'search', params: { dateRange: { start: '2024-01-01', end: '2024-12-31' } } },
      { operation: 'bulk_update', params: { criteria: { field: 'amount', operator: 'greaterThan', value: 1000 }, dateRange: { start: '2024-01-01', end: '2024-12-31' }, updates: {}, expectedCount: 0 } },
      { operation: 'bulk_delete', params: { criteria: { field: 'amount', operator: 'greaterThan', value: 1000 }, dateRange: { start: '2024-01-01', end: '2024-12-31' }, expectedCount: 0 } },
    ];

    for (const testCase of testCases) {
      it(`${testCase.operation} operationが正常に実行される`, async () => {
        const result = await executeTool({
          operation: testCase.operation,
          params: testCase.params
        });
        expect(result.success).toBe(true);
        expect(result.operation).toBe(testCase.operation);
      });
    }
  });
});

describe('zaim_execute Tool - バッチ処理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ExecuteToolInputSchema - バッチ入力', () => {
    it('batchのみの入力を受け付ける', () => {
      const result = ExecuteToolInputSchema.safeParse({
        batch: [
          { operation: 'check_auth' },
          { operation: 'get_user' }
        ]
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batch).toHaveLength(2);
        expect(result.data.operation).toBeUndefined();
      }
    });

    it('batchの各要素にparamsを含められる', () => {
      const result = ExecuteToolInputSchema.safeParse({
        batch: [
          { operation: 'get_money', params: { limit: 10 } },
          { operation: 'get_default_genres', params: { mode: 'payment' } }
        ]
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batch![0].params).toEqual({ limit: 10 });
        expect(result.data.batch![1].params).toEqual({ mode: 'payment' });
      }
    });

    it('operationとbatchの同時指定を拒否する', () => {
      const result = ExecuteToolInputSchema.safeParse({
        operation: 'check_auth',
        batch: [{ operation: 'get_user' }]
      });
      expect(result.success).toBe(false);
    });

    it('空のbatch配列を拒否する', () => {
      const result = ExecuteToolInputSchema.safeParse({
        batch: []
      });
      expect(result.success).toBe(false);
    });

    it('operationもbatchも未指定を拒否する', () => {
      const result = ExecuteToolInputSchema.safeParse({
        params: { test: 'value' }
      });
      expect(result.success).toBe(false);
    });
  });

  describe('executeTool - バッチ実行', () => {
    it('複数の操作を順次実行し結果を集約する', async () => {
      const result = await executeTool({
        batch: [
          { operation: 'check_auth' },
          { operation: 'get_user' },
          { operation: 'get_categories' }
        ]
      });

      // バッチ結果の形式を確認
      expect('results' in result).toBe(true);
      expect('summary' in result).toBe(true);
      
      const batchResult = result as any;
      expect(batchResult.results).toHaveLength(3);
      expect(batchResult.summary.total).toBe(3);
      expect(batchResult.summary.success).toBe(3);
      expect(batchResult.summary.failed).toBe(0);
      expect(batchResult.success).toBe(true);
    });

    it('一部の操作が失敗した場合のサマリーが正しい', async () => {
      const result = await executeTool({
        batch: [
          { operation: 'check_auth' },
          { operation: 'invalid_operation' },
          { operation: 'get_user' }
        ]
      });

      const batchResult = result as any;
      expect(batchResult.results).toHaveLength(3);
      expect(batchResult.summary.total).toBe(3);
      expect(batchResult.summary.success).toBe(2);
      expect(batchResult.summary.failed).toBe(1);
      expect(batchResult.success).toBe(false);
      expect(batchResult.message).toContain('2件成功');
      expect(batchResult.message).toContain('1件失敗');
    });

    it('各結果にindexが正しく含まれる', async () => {
      const result = await executeTool({
        batch: [
          { operation: 'check_auth' },
          { operation: 'get_user' }
        ]
      });

      const batchResult = result as any;
      expect(batchResult.results[0].index).toBe(0);
      expect(batchResult.results[1].index).toBe(1);
    });

    it('各結果にoperation名が正しく含まれる', async () => {
      const result = await executeTool({
        batch: [
          { operation: 'check_auth' },
          { operation: 'get_money' }
        ]
      });

      const batchResult = result as any;
      expect(batchResult.results[0].operation).toBe('check_auth');
      expect(batchResult.results[1].operation).toBe('get_money');
    });

    it('パラメータ付きの操作がバッチで正しく実行される', async () => {
      const result = await executeTool({
        batch: [
          { operation: 'get_default_genres', params: { mode: 'payment' } },
          { operation: 'get_default_categories', params: { mode: 'income' } }
        ]
      });

      const batchResult = result as any;
      expect(batchResult.success).toBe(true);
      expect(batchResult.results).toHaveLength(2);
      expect(batchResult.results[0].success).toBe(true);
      expect(batchResult.results[1].success).toBe(true);
    });

    it('全操作が成功した場合のメッセージが正しい', async () => {
      const result = await executeTool({
        batch: [
          { operation: 'check_auth' }
        ]
      });

      const batchResult = result as any;
      expect(batchResult.message).toContain('すべて成功');
    });
  });

  describe('executeToolDefinition - バッチ対応', () => {
    it('入力スキーマにbatchパラメータが含まれる', () => {
      expect(executeToolDefinition.inputSchema.properties).toHaveProperty('batch');
    });

    it('batchパラメータの説明が正しい', () => {
      const batchProp = (executeToolDefinition.inputSchema.properties as any).batch;
      expect(batchProp.description).toContain('複数の操作');
    });

    it('descriptionにbatch機能の説明が含まれる', () => {
      expect(executeToolDefinition.description).toContain('batch');
    });
  });
});
