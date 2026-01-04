import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bulkDeleteTool,
  bulkDeleteToolDefinition,
  BulkDeleteToolInput,
  BulkDeleteToolInputSchema,
} from '../../src/tools/advanced/bulk-delete-tool.js';
import { TokenStorage } from '../../src/utils/token-storage.js';

// TokenStorageのモック
vi.mock('../../src/utils/token-storage.js', () => ({
  TokenStorage: {
    createZaimApiClient: vi.fn(),
  },
}));

const mockTokenStorage = vi.mocked(TokenStorage);

describe('Bulk Delete Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
      delete: vi.fn(),
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
        expectedCount: 5,
      };

      const result = BulkDeleteToolInputSchema.parse(input);
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
        expectedCount: 5,
        dryRun: true,
      };

      const result = BulkDeleteToolInputSchema.parse(input);
      expect(result.dryRun).toBe(true);
    });

    it('should reject input without criteria', () => {
      const input = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 5,
      };

      expect(() => BulkDeleteToolInputSchema.parse(input)).toThrow();
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
      };

      expect(() => BulkDeleteToolInputSchema.parse(input)).toThrow();
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
        expectedCount: 5,
        unknownField: 'test',
      };

      expect(() => BulkDeleteToolInputSchema.parse(input)).toThrow();
    });
  });

  describe('Empty Criteria Check', () => {
    it('should return error when criteria is empty composite condition', async () => {
      const input: BulkDeleteToolInput = {
        criteria: {
          operator: 'AND',
          conditions: [],
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 1,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(false);
      expect(result.message).toContain('安全エラー');
      expect(result.message).toContain('空');
    });

    it('should succeed with valid criteria', async () => {
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
      mockClient.delete.mockResolvedValue({ success: true });

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 1,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(true);
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

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 5, // 実際は2件なので不一致
      };

      const result = await bulkDeleteTool(input);

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
      mockClient.delete.mockResolvedValue({ success: true });

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 2, // 実際と一致
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(true);
      expect(result.stats.successCount).toBe(2);
    });
  });

  describe('DryRun Mode', () => {
    it('should return preview without actual delete in dryRun mode', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー',
            name: '食料品',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 2000,
            place: 'スーパーマーケット',
            name: '日用品',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 2,
        dryRun: true,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(true);
      expect(result.message).toContain('ドライラン');
      expect(result.stats.dryRun).toBe(true);
      expect(result.stats.targetCount).toBe(2);
      // deleteが呼ばれていないことを確認
      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it('should include summary in dryRun preview', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー',
            name: '食料品',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 1,
        dryRun: true,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1);
      expect(result.results[0].summary?.date).toBe('2024-01-15');
      expect(result.results[0].summary?.amount).toBe(1000);
      expect(result.results[0].summary?.place).toBe('スーパー');
      expect(result.results[0].summary?.name).toBe('食料品');
    });
  });

  describe('Actual Delete', () => {
    it('should delete all matching records', async () => {
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
      mockClient.delete.mockResolvedValue({ success: true });

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 2,
        dryRun: false,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(true);
      expect(result.stats.successCount).toBe(2);
      expect(result.stats.failureCount).toBe(0);
      expect(mockClient.delete).toHaveBeenCalledTimes(2);
      expect(mockClient.delete).toHaveBeenCalledWith('/v2/home/money/payment/1');
      expect(mockClient.delete).toHaveBeenCalledWith('/v2/home/money/payment/2');
    });

    it('should handle mixed mode records', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'テスト',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'income',
            date: '2024-01-16',
            amount: 50000,
            place: 'テスト会社',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);
      mockClient.delete.mockResolvedValue({ success: true });

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'テスト',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 2,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(true);
      expect(mockClient.delete).toHaveBeenCalledWith('/v2/home/money/payment/1');
      expect(mockClient.delete).toHaveBeenCalledWith('/v2/home/money/income/2');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('API Error'));

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 1,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(false);
      expect(result.message).toContain('エラー');
    });

    it('should handle partial delete failures', async () => {
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
      mockClient.delete
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Delete failed'));

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 2,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(false);
      expect(result.stats.successCount).toBe(1);
      expect(result.stats.failureCount).toBe(1);
    });

    it('should handle zero matching records', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'コンビニ',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: BulkDeleteToolInput = {
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        expectedCount: 0,
      };

      const result = await bulkDeleteTool(input);

      expect(result.success).toBe(true);
      expect(result.stats.targetCount).toBe(0);
      expect(result.stats.successCount).toBe(0);
    });
  });

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      expect(bulkDeleteToolDefinition.name).toBe('zaim_bulk_delete');
      expect(bulkDeleteToolDefinition.description).toContain('一括削除');
      expect(bulkDeleteToolDefinition.inputSchema.required).toContain('criteria');
      expect(bulkDeleteToolDefinition.inputSchema.required).toContain('dateRange');
      expect(bulkDeleteToolDefinition.inputSchema.required).toContain('expectedCount');
    });
  });
});
