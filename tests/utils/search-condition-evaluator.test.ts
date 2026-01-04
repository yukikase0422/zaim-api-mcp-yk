import { describe, it, expect } from 'vitest';
import {
  evaluateStringCondition,
  evaluateNumberCondition,
  evaluateDateCondition,
  evaluateModeCondition,
  evaluateCondition,
  evaluateCompositeCondition,
  evaluateCriteria,
  filterRecords,
  sortRecords,
  searchAndSort,
  formatOutput,
} from '../../src/utils/search-condition-evaluator.js';
import type { ZaimMoney } from '../../src/types/zaim-api.js';
import type {
  StringCondition,
  NumberCondition,
  DateCondition,
  ModeCondition,
  CompositeCondition,
} from '../../src/types/advanced-search.js';

// テスト用のモックデータ
const mockRecord: ZaimMoney = {
  id: 1,
  mode: 'payment',
  date: '2024-01-15',
  amount: 1500,
  place: 'スーパーマーケット',
  name: '食料品',
  comment: 'テストコメント',
  category_id: 101,
  genre_id: 201,
  from_account_id: 1,
  to_account_id: 0,
  currency_code: 'JPY',
  receipt_id: null,
  created: '2024-01-15T10:00:00+09:00',
  active: 1,
};

describe('Search Condition Evaluator', () => {
  describe('evaluateStringCondition', () => {
    it('should match equals operator', () => {
      const condition: StringCondition = {
        field: 'place',
        operator: 'equals',
        value: 'スーパーマーケット',
      };
      expect(evaluateStringCondition(mockRecord, condition)).toBe(true);
    });

    it('should not match equals when different', () => {
      const condition: StringCondition = {
        field: 'place',
        operator: 'equals',
        value: 'スーパー',
      };
      expect(evaluateStringCondition(mockRecord, condition)).toBe(false);
    });

    it('should match contains operator', () => {
      const condition: StringCondition = {
        field: 'place',
        operator: 'contains',
        value: 'スーパー',
      };
      expect(evaluateStringCondition(mockRecord, condition)).toBe(true);
    });

    it('should match startsWith operator', () => {
      const condition: StringCondition = {
        field: 'place',
        operator: 'startsWith',
        value: 'スーパー',
      };
      expect(evaluateStringCondition(mockRecord, condition)).toBe(true);
    });

    it('should match endsWith operator', () => {
      const condition: StringCondition = {
        field: 'place',
        operator: 'endsWith',
        value: 'マーケット',
      };
      expect(evaluateStringCondition(mockRecord, condition)).toBe(true);
    });

    it('should handle case-insensitive matching', () => {
      const condition: StringCondition = {
        field: 'name',
        operator: 'contains',
        value: '食料品',
        caseSensitive: false,
      };
      expect(evaluateStringCondition(mockRecord, condition)).toBe(true);
    });

    it('should return false for undefined field', () => {
      const recordWithoutPlace = { ...mockRecord, place: undefined };
      const condition: StringCondition = {
        field: 'place',
        operator: 'contains',
        value: 'スーパー',
      };
      expect(evaluateStringCondition(recordWithoutPlace as ZaimMoney, condition)).toBe(false);
    });
  });

  describe('evaluateNumberCondition', () => {
    it('should match equals operator', () => {
      const condition: NumberCondition = {
        field: 'amount',
        operator: 'equals',
        value: 1500,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(true);
    });

    it('should match notEquals operator', () => {
      const condition: NumberCondition = {
        field: 'amount',
        operator: 'notEquals',
        value: 1000,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(true);
    });

    it('should match greaterThan operator', () => {
      const condition: NumberCondition = {
        field: 'amount',
        operator: 'greaterThan',
        value: 1000,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(true);
    });

    it('should match lessThan operator', () => {
      const condition: NumberCondition = {
        field: 'amount',
        operator: 'lessThan',
        value: 2000,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(true);
    });

    it('should match greaterOrEqual operator', () => {
      const condition: NumberCondition = {
        field: 'amount',
        operator: 'greaterOrEqual',
        value: 1500,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(true);
    });

    it('should match lessOrEqual operator', () => {
      const condition: NumberCondition = {
        field: 'amount',
        operator: 'lessOrEqual',
        value: 1500,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(true);
    });

    it('should match between operator', () => {
      const condition: NumberCondition = {
        field: 'amount',
        operator: 'between',
        min: 1000,
        max: 2000,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(true);
    });

    it('should not match between when outside range', () => {
      const condition: NumberCondition = {
        field: 'amount',
        operator: 'between',
        min: 2000,
        max: 3000,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(false);
    });

    it('should return false for non-numeric field', () => {
      const condition: NumberCondition = {
        field: 'place' as any,
        operator: 'equals',
        value: 1000,
      };
      expect(evaluateNumberCondition(mockRecord, condition)).toBe(false);
    });
  });

  describe('evaluateDateCondition', () => {
    it('should match equals operator', () => {
      const condition: DateCondition = {
        field: 'date',
        operator: 'equals',
        value: '2024-01-15',
      };
      expect(evaluateDateCondition(mockRecord, condition)).toBe(true);
    });

    it('should match before operator', () => {
      const condition: DateCondition = {
        field: 'date',
        operator: 'before',
        value: '2024-01-20',
      };
      expect(evaluateDateCondition(mockRecord, condition)).toBe(true);
    });

    it('should match after operator', () => {
      const condition: DateCondition = {
        field: 'date',
        operator: 'after',
        value: '2024-01-10',
      };
      expect(evaluateDateCondition(mockRecord, condition)).toBe(true);
    });

    it('should match onOrBefore operator', () => {
      const condition: DateCondition = {
        field: 'date',
        operator: 'onOrBefore',
        value: '2024-01-15',
      };
      expect(evaluateDateCondition(mockRecord, condition)).toBe(true);
    });

    it('should match onOrAfter operator', () => {
      const condition: DateCondition = {
        field: 'date',
        operator: 'onOrAfter',
        value: '2024-01-15',
      };
      expect(evaluateDateCondition(mockRecord, condition)).toBe(true);
    });

    it('should match between operator', () => {
      const condition: DateCondition = {
        field: 'date',
        operator: 'between',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      expect(evaluateDateCondition(mockRecord, condition)).toBe(true);
    });

    it('should not match between when outside range', () => {
      const condition: DateCondition = {
        field: 'date',
        operator: 'between',
        startDate: '2024-02-01',
        endDate: '2024-02-28',
      };
      expect(evaluateDateCondition(mockRecord, condition)).toBe(false);
    });
  });

  describe('evaluateModeCondition', () => {
    it('should match payment mode', () => {
      const condition: ModeCondition = {
        field: 'mode',
        operator: 'equals',
        value: 'payment',
      };
      expect(evaluateModeCondition(mockRecord, condition)).toBe(true);
    });

    it('should not match different mode', () => {
      const condition: ModeCondition = {
        field: 'mode',
        operator: 'equals',
        value: 'income',
      };
      expect(evaluateModeCondition(mockRecord, condition)).toBe(false);
    });
  });

  describe('evaluateCondition (unified)', () => {
    it('should evaluate string condition', () => {
      const condition = {
        field: 'place',
        operator: 'contains',
        value: 'スーパー',
      };
      expect(evaluateCondition(mockRecord, condition as any)).toBe(true);
    });

    it('should evaluate number condition', () => {
      const condition = {
        field: 'amount',
        operator: 'greaterThan',
        value: 1000,
      };
      expect(evaluateCondition(mockRecord, condition as any)).toBe(true);
    });

    it('should evaluate date condition', () => {
      const condition = {
        field: 'date',
        operator: 'equals',
        value: '2024-01-15',
      };
      expect(evaluateCondition(mockRecord, condition as any)).toBe(true);
    });

    it('should evaluate mode condition', () => {
      const condition = {
        field: 'mode',
        operator: 'equals',
        value: 'payment',
      };
      expect(evaluateCondition(mockRecord, condition as any)).toBe(true);
    });
  });

  describe('evaluateCompositeCondition', () => {
    it('should handle AND conditions (all match)', () => {
      const composite: CompositeCondition = {
        operator: 'AND',
        conditions: [
          { field: 'place', operator: 'contains', value: 'スーパー' },
          { field: 'amount', operator: 'greaterThan', value: 1000 },
        ],
      };
      expect(evaluateCompositeCondition(mockRecord, composite)).toBe(true);
    });

    it('should handle AND conditions (some do not match)', () => {
      const composite: CompositeCondition = {
        operator: 'AND',
        conditions: [
          { field: 'place', operator: 'contains', value: 'スーパー' },
          { field: 'amount', operator: 'greaterThan', value: 2000 },
        ],
      };
      expect(evaluateCompositeCondition(mockRecord, composite)).toBe(false);
    });

    it('should handle OR conditions (at least one match)', () => {
      const composite: CompositeCondition = {
        operator: 'OR',
        conditions: [
          { field: 'place', operator: 'contains', value: 'コンビニ' },
          { field: 'amount', operator: 'greaterThan', value: 1000 },
        ],
      };
      expect(evaluateCompositeCondition(mockRecord, composite)).toBe(true);
    });

    it('should handle OR conditions (none match)', () => {
      const composite: CompositeCondition = {
        operator: 'OR',
        conditions: [
          { field: 'place', operator: 'contains', value: 'コンビニ' },
          { field: 'amount', operator: 'greaterThan', value: 2000 },
        ],
      };
      expect(evaluateCompositeCondition(mockRecord, composite)).toBe(false);
    });

    it('should handle empty conditions (returns true)', () => {
      const composite: CompositeCondition = {
        operator: 'AND',
        conditions: [],
      };
      expect(evaluateCompositeCondition(mockRecord, composite)).toBe(true);
    });

    it('should handle nested composite conditions', () => {
      const composite: CompositeCondition = {
        operator: 'AND',
        conditions: [
          { field: 'mode', operator: 'equals', value: 'payment' },
          {
            operator: 'OR',
            conditions: [
              { field: 'place', operator: 'contains', value: 'スーパー' },
              { field: 'place', operator: 'contains', value: 'コンビニ' },
            ],
          },
        ],
      };
      expect(evaluateCompositeCondition(mockRecord, composite)).toBe(true);
    });
  });

  describe('filterRecords', () => {
    const records: ZaimMoney[] = [
      { ...mockRecord, id: 1, place: 'スーパーA', amount: 1000 },
      { ...mockRecord, id: 2, place: 'スーパーB', amount: 2000 },
      { ...mockRecord, id: 3, place: 'コンビニ', amount: 500 },
    ];

    it('should filter by single condition', () => {
      const criteria = {
        field: 'place',
        operator: 'contains',
        value: 'スーパー',
      };
      const result = filterRecords(records, criteria as any);
      expect(result.length).toBe(2);
    });

    it('should filter by composite condition', () => {
      const criteria: CompositeCondition = {
        operator: 'AND',
        conditions: [
          { field: 'place', operator: 'contains', value: 'スーパー' },
          { field: 'amount', operator: 'greaterThan', value: 1500 },
        ],
      };
      const result = filterRecords(records, criteria);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(2);
    });
  });

  describe('sortRecords', () => {
    it('should sort by date descending', () => {
      const records: ZaimMoney[] = [
        { ...mockRecord, id: 1, date: '2024-01-10' },
        { ...mockRecord, id: 2, date: '2024-01-20' },
        { ...mockRecord, id: 3, date: '2024-01-15' },
      ];

      const result = sortRecords(records);

      expect(result[0].date).toBe('2024-01-20');
      expect(result[1].date).toBe('2024-01-15');
      expect(result[2].date).toBe('2024-01-10');
    });

    it('should sort by place when dates are equal', () => {
      const records: ZaimMoney[] = [
        { ...mockRecord, id: 1, date: '2024-01-15', place: 'Bスーパー' },
        { ...mockRecord, id: 2, date: '2024-01-15', place: 'Aスーパー' },
      ];

      const result = sortRecords(records);

      expect(result[0].place).toBe('Aスーパー');
      expect(result[1].place).toBe('Bスーパー');
    });

    it('should sort by name when dates and places are equal', () => {
      const records: ZaimMoney[] = [
        { ...mockRecord, id: 1, date: '2024-01-15', place: 'スーパー', name: '野菜' },
        { ...mockRecord, id: 2, date: '2024-01-15', place: 'スーパー', name: '肉' },
      ];

      const result = sortRecords(records);

      expect(result[0].name).toBe('肉');
      expect(result[1].name).toBe('野菜');
    });
  });

  describe('searchAndSort', () => {
    const records: ZaimMoney[] = [
      { ...mockRecord, id: 1, date: '2024-01-10', place: 'スーパー', amount: 1000 },
      { ...mockRecord, id: 2, date: '2024-01-20', place: 'スーパー', amount: 2000 },
      { ...mockRecord, id: 3, date: '2024-01-15', place: 'コンビニ', amount: 500 },
    ];

    it('should filter and sort records', () => {
      const criteria = {
        field: 'place',
        operator: 'contains',
        value: 'スーパー',
      };

      const result = searchAndSort(records, criteria as any);

      expect(result.length).toBe(2);
      expect(result[0].date).toBe('2024-01-20');
      expect(result[1].date).toBe('2024-01-10');
    });

    it('should respect maxRecords limit', () => {
      const criteria = {
        field: 'date',
        operator: 'onOrAfter',
        value: '2024-01-01',
      };

      const result = searchAndSort(records, criteria as any, 2);

      expect(result.length).toBe(2);
    });
  });

  describe('formatOutput', () => {
    const records: ZaimMoney[] = [
      { ...mockRecord, id: 1, place: 'スーパー' },
      { ...mockRecord, id: 2, place: 'コンビニ' },
    ];

    it('should return id_only format', () => {
      const result = formatOutput(records, { mode: 'id_only' });

      expect(result.records).toEqual([1, 2]);
      expect(result.count).toBe(2);
    });

    it('should return specified fields only', () => {
      const result = formatOutput(records, {
        mode: 'specified',
        fields: ['id', 'place'],
      });

      expect(result.count).toBe(2);
      const firstRecord = result.records[0] as any;
      expect(firstRecord.id).toBe(1);
      expect(firstRecord.place).toBe('スーパー');
      expect(firstRecord.amount).toBeUndefined();
    });

    it('should return full records by default', () => {
      const result = formatOutput(records);

      expect(result.count).toBe(2);
      const firstRecord = result.records[0] as any;
      expect(firstRecord.amount).toBeDefined();
    });

    it('should truncate based on maxTotalChars', () => {
      const manyRecords = Array.from({ length: 100 }, (_, i) => ({
        ...mockRecord,
        id: i + 1,
      }));

      const result = formatOutput(manyRecords, { maxTotalChars: 500 });

      expect(result.truncated).toBe(true);
      expect(result.count).toBeLessThan(100);
    });

    it('should report truncated count', () => {
      const manyRecords = Array.from({ length: 100 }, (_, i) => ({
        ...mockRecord,
        id: i + 1,
      }));

      const result = formatOutput(manyRecords, { maxTotalChars: 500 });

      expect(result.truncatedCount).toBeGreaterThan(0);
      expect(result.count + result.truncatedCount).toBe(100);
    });
  });
});
