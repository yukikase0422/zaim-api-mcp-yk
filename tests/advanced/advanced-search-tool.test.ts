import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  advancedSearchTool,
  advancedSearchToolDefinition,
  AdvancedSearchToolInput,
  AdvancedSearchToolInputSchema,
} from '../../src/tools/advanced/advanced-search-tool.js';
import { TokenStorage } from '../../src/utils/token-storage.js';

// TokenStorageのモック
vi.mock('../../src/utils/token-storage.js', () => ({
  TokenStorage: {
    createZaimApiClient: vi.fn(),
  },
}));

const mockTokenStorage = vi.mocked(TokenStorage);

describe('Advanced Search Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
    };
    mockTokenStorage.createZaimApiClient.mockReturnValue(mockClient);
  });

  describe('Input Schema Validation', () => {
    it('should accept valid input with dateRange only', () => {
      const input = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      const result = AdvancedSearchToolInputSchema.parse(input);
      expect(result.dateRange.start).toBe('2024-01-01');
      expect(result.dateRange.end).toBe('2024-01-31');
    });

    it('should accept valid input with criteria', () => {
      const input = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
      };

      const result = AdvancedSearchToolInputSchema.parse(input);
      expect(result.criteria).toBeDefined();
    });

    it('should accept valid input with output control', () => {
      const input = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        output: {
          mode: 'id_only' as const,
        },
      };

      const result = AdvancedSearchToolInputSchema.parse(input);
      expect(result.output?.mode).toBe('id_only');
    });

    it('should accept valid input with limit', () => {
      const input = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        limit: 50,
      };

      const result = AdvancedSearchToolInputSchema.parse(input);
      expect(result.limit).toBe(50);
    });

    it('should reject invalid dateRange', () => {
      const input = {
        dateRange: {
          start: '2024-01-01',
        },
      };

      expect(() => AdvancedSearchToolInputSchema.parse(input)).toThrow();
    });

    it('should reject additional properties', () => {
      const input = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        unknownField: 'test',
      };

      expect(() => AdvancedSearchToolInputSchema.parse(input)).toThrow();
    });
  });

  describe('Single Condition Search', () => {
    it('should search by place containing keyword', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパーマーケット',
            name: '食料品',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 500,
            place: 'コンビニ',
            name: 'お菓子',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        criteria: {
          field: 'place',
          operator: 'contains',
          value: 'スーパー',
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.records.length).toBe(1);
    });

    it('should search by amount equals', async () => {
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
            place: 'コンビニ',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        criteria: {
          field: 'amount',
          operator: 'equals',
          value: 1000,
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should search by mode', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'income',
            date: '2024-01-16',
            amount: 50000,
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        criteria: {
          field: 'mode',
          operator: 'equals',
          value: 'income',
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe('Composite Condition Search (AND/OR)', () => {
    it('should handle AND conditions', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1500,
            place: 'スーパー',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 500,
            place: 'スーパー',
            currency_code: 'JPY',
          },
          {
            id: 3,
            mode: 'payment',
            date: '2024-01-17',
            amount: 1500,
            place: 'コンビニ',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        criteria: {
          operator: 'AND',
          conditions: [
            {
              field: 'place',
              operator: 'contains',
              value: 'スーパー',
            },
            {
              field: 'amount',
              operator: 'greaterThan',
              value: 1000,
            },
          ],
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect((result.records[0] as any).id).toBe(1);
    });

    it('should handle OR conditions', async () => {
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
            mode: 'income',
            date: '2024-01-16',
            amount: 50000,
            place: '会社',
            currency_code: 'JPY',
          },
          {
            id: 3,
            mode: 'payment',
            date: '2024-01-17',
            amount: 500,
            place: 'コンビニ',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        criteria: {
          operator: 'OR',
          conditions: [
            {
              field: 'place',
              operator: 'contains',
              value: 'スーパー',
            },
            {
              field: 'mode',
              operator: 'equals',
              value: 'income',
            },
          ],
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should handle nested conditions', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1500,
            place: 'スーパーA',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 2000,
            place: 'スーパーB',
            currency_code: 'JPY',
          },
          {
            id: 3,
            mode: 'payment',
            date: '2024-01-17',
            amount: 500,
            place: 'コンビニ',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        criteria: {
          operator: 'AND',
          conditions: [
            {
              field: 'place',
              operator: 'contains',
              value: 'スーパー',
            },
            {
              operator: 'OR',
              conditions: [
                {
                  field: 'amount',
                  operator: 'greaterThan',
                  value: 1800,
                },
                {
                  field: 'amount',
                  operator: 'lessThan',
                  value: 1600,
                },
              ],
            },
          ],
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe('Output Control', () => {
    it('should return id_only when mode is id_only', async () => {
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
            place: 'コンビニ',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        output: {
          mode: 'id_only',
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      // ソート順（日付降順）により、id=2（2024-01-16）が先に来る
      expect(result.records).toEqual([2, 1]);
    });

    it('should return specified fields only', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'スーパー',
            name: '食料品',
            comment: 'テスト',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        output: {
          mode: 'specified',
          fields: ['id', 'date', 'amount'],
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      const record = result.records[0] as any;
      expect(record.id).toBe(1);
      expect(record.date).toBe('2024-01-15');
      expect(record.amount).toBe(1000);
      expect(record.place).toBeUndefined();
      expect(record.comment).toBeUndefined();
    });

    it('should respect maxRecords limit', async () => {
      const mockResponse = {
        money: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          mode: 'payment',
          date: '2024-01-15',
          amount: 1000 * (i + 1),
          currency_code: 'JPY',
        })),
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        output: {
          maxRecords: 5,
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBeLessThanOrEqual(5);
    });
  });

  describe('Sort Order', () => {
    it('should sort by date descending, then place, then name', async () => {
      const mockResponse = {
        money: [
          {
            id: 1,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1000,
            place: 'Aスーパー',
            name: '野菜',
            currency_code: 'JPY',
          },
          {
            id: 2,
            mode: 'payment',
            date: '2024-01-16',
            amount: 2000,
            place: 'Bスーパー',
            name: '肉',
            currency_code: 'JPY',
          },
          {
            id: 3,
            mode: 'payment',
            date: '2024-01-15',
            amount: 1500,
            place: 'Aスーパー',
            name: '魚',
            currency_code: 'JPY',
          },
        ],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      // 日付降順でソートされるべき
      expect((result.records[0] as any).date).toBe('2024-01-16');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('API Error'));

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(false);
      expect(result.message).toContain('エラー');
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        money: [],
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.records).toEqual([]);
    });

    it('should handle invalid response format', async () => {
      mockClient.get.mockResolvedValue({ invalid: 'response' });

      const input: AdvancedSearchToolInput = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      const result = await advancedSearchTool(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      expect(advancedSearchToolDefinition.name).toBe('zaim_advanced_search');
      expect(advancedSearchToolDefinition.description).toContain('高度な検索');
      expect(advancedSearchToolDefinition.inputSchema.required).toContain('dateRange');
    });
  });
});
