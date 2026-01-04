import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bulkUpdateTool,
  bulkUpdateToolDefinition,
  BulkUpdateToolInput,
  BulkUpdateToolInputSchema,
} from '../../src/tools/advanced/bulk-update-tool.js';
import { TokenStorage } from '../../src/utils/token-storage.js';

// TokenStorageのモック
vi.mock('../../src/utils/token-storage.js', () => ({
  TokenStorage: {
    createZaimApiClient: vi.fn(),
  },
}));

const mockTokenStorage = vi.mocked(TokenStorage);

describe('Bulk Update Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
      put: vi.fn(),
    };
    mockTokenStorage.createZaimApiClient.mockReturnValue(mockClient);
  });

  describe('Input Schema Validation', () => {
    it('should accept valid input with all required fields', () => {
      const input = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          category_id: 101,
        },
        expectedCount: 5,
      };

      const result = BulkUpdateToolInputSchema.parse(input);
      expect(result.expectedCount).toBe(5);
    });

    it('should accept valid input with dryRun option', () => {
      const input = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          category_id: 101,
        },
        expectedCount: 5,
        dryRun: true,
      };

      const result = BulkUpdateToolInputSchema.parse(input);
      expect(result.dryRun).toBe(true);
    });

    it('should reject input without criteria', () => {
      const input = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          category_id: 101,
        },
        expectedCount: 5,
      };

      expect(() => BulkUpdateToolInputSchema.parse(input)).toThrow();
    });

    it('should reject input without expectedCount', () => {
      const input = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          category_id: 101,
        },
      };

      expect(() => BulkUpdateToolInputSchema.parse(input)).toThrow();
    });

    it('should reject additional properties', () => {
      const input = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          category_id: 101,
        },
        expectedCount: 5,
        unknownField: 'test',
      };

      expect(() => BulkUpdateToolInputSchema.parse(input)).toThrow();
    });
  });

  describe('Expected Count Mismatch Error', () => {
    it('should return error when actual count does not match expectedCount', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 2000,
            place: 'スーパーマーケット',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          // 検索条件に含まれるplaceフィールドを更新
          place: {
            mode: 'replace',
            newValue: '新スーパー',
          },
        },
        expectedCount: 5, // 実際は2件なので不一致
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(false);
      expect(result.message).toContain('件数不一致');
      expect(result.stats.targetCount).toBe(2);
    });

    it('should succeed when actual count matches expectedCount', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー',
            category_id: 100,
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 2000,
            place: 'スーパーマーケット',
            category_id: 100,
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);
      mockClient.put.mockResolvedValue({ success: true });

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          place: {
            mode: 'replace',
            newValue: '新スーパー',
          },
        },
        expectedCount: 2, // 実際と一致
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(true);
      expect(result.stats.successCount).toBe(2);
    });
  });

  describe('Criteria and Update Fields Consistency Check', () => {
    it('should return error when update field is not in criteria', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          category_id: 101, // placeの検索条件にはcategory_idがない
        },
        expectedCount: 1,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(false);
      expect(result.message).toContain('整合性エラー');
      expect(result.message).toContain('category_id');
    });

    it('should succeed when update field is in criteria', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー',
            category_id: 100,
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);
      mockClient.put.mockResolvedValue({ success: true });

      const input: BulkUpdateToolInput = {
        criteria: {
          operator: 'AND',
          conditions: [
            {
              field: 'place',
              operator: 'contains',
              value: 'スーパー',
            },
            {
              field: 'category_id',
              operator: 'equals',
              value: 100,
            },
          ],
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          category_id: 101, // 検索条件にcategory_idがある
        },
        expectedCount: 1,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(true);
    });
  });

  describe('DryRun Mode', () => {
    it('should return preview without actual update in dryRun mode', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 2000,
            place: 'スーパーマーケット',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          place: {
            mode: 'replace',
            newValue: '新スーパー',
          },
        },
        expectedCount: 2,
        dryRun: true,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(true);
      expect(result.message).toContain('ドライラン');
      expect(result.stats.dryRun).toBe(true);
      expect(result.stats.targetCount).toBe(2);
      // putが呼ばれていないことを確認
      expect(mockClient.put).not.toHaveBeenCalled();
    });

    it('should include before/after values in dryRun preview', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: '旧スーパー',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          place: {
            mode: 'replace',
            newValue: '新スーパー',
          },
        },
        expectedCount: 1,
        dryRun: true,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1);
      expect(result.results[0].before?.place).toBe('旧スーパー');
      expect(result.results[0].after?.place).toBe('新スーパー');
    });
  });

  describe('String Replace/Partial Replace', () => {
    it('should perform complete replace', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: '旧店舗名',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);
      mockClient.put.mockResolvedValue({ success: true });

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'equals',
          value: '旧店舗名',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          place: {
            mode: 'replace',
            newValue: '新店舗名',
          },
        },
        expectedCount: 1,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(true);
      expect(result.results[0].after?.place).toBe('新店舗名');
    });

    it('should perform partial replace', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'ABC店舗DEF',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);
      mockClient.put.mockResolvedValue({ success: true });

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: '店舗',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          place: {
            mode: 'partial',
            searchPattern: '店舗',
            replaceWith: 'ショップ',
          },
        },
        expectedCount: 1,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(true);
      expect(result.results[0].after?.place).toBe('ABCショップDEF');
    });

    it('should handle comment update with replace mode', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            comment: '旧コメント',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);
      mockClient.put.mockResolvedValue({ success: true });

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'comment',
          operator: 'contains',
          value: 'コメント',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          comment: {
            mode: 'replace',
            newValue: '新コメント',
          },
        },
        expectedCount: 1,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(true);
      expect(result.results[0].after?.comment).toBe('新コメント');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('API Error'));

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          place: {
            mode: 'replace',
            newValue: '新スーパー',
          },
        },
        expectedCount: 1,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(false);
      expect(result.message).toContain('エラー');
    });

    it('should handle partial update failures', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー1',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 2000,
            place: 'スーパー2',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);
      // 1件目は成功、2件目は失敗
      mockClient.put
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Update failed'));

      const input: BulkUpdateToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        updates: {
          place: {
            mode: 'replace',
            newValue: '新スーパー',
          },
        },
        expectedCount: 2,
      };

      const result = await bulkUpdateTool(input);

      expect(result.success).toBe(false);
      expect(result.stats.successCount).toBe(1);
      expect(result.stats.failureCount).toBe(1);
    });
  });

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      expect(bulkUpdateToolDefinition.name).toBe('zaim_bulk_update');
      expect(bulkUpdateToolDefinition.description).toContain('一括更新');
      expect(bulkUpdateToolDefinition.inputSchema.required).toContain('criteria');
      expect(bulkUpdateToolDefinition.inputSchema.required).toContain('dateRange');
      expect(bulkUpdateToolDefinition.inputSchema.required).toContain('updates');
      expect(bulkUpdateToolDefinition.inputSchema.required).toContain('expectedCount');
    });
  });
});
