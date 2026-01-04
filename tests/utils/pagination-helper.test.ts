import { describe, it, expect, vi } from 'vitest';
import {
  delay,
  fetchAllRecords,
  splitDateRange,
  formatDate,
  fetchByDateRanges,
  removeDuplicates,
  estimateRecordCount,
  PaginationOptionsSchema,
} from '../../src/utils/pagination-helper.js';
import type { ZaimMoney } from '../../src/types/zaim-api.js';

// テスト用のモックレコード生成
function createMockRecord(id: number, date: string): ZaimMoney {
  return {
    id,
    mode: 'payment',
    date,
    amount: 1000 * id,
    place: `店舗${id}`,
    name: `品目${id}`,
    currency_code: 'JPY',
    category_id: 101,
    genre_id: 201,
    from_account_id: 1,
    to_account_id: 0,
    receipt_id: null,
    created: `${date}T10:00:00+09:00`,
    active: 1,
  };
}

describe('Pagination Helper', () => {
  describe('PaginationOptionsSchema', () => {
    it('should apply default values', () => {
      const result = PaginationOptionsSchema.parse({});

      expect(result.startPage).toBe(1);
      expect(result.pageSize).toBe(100);
      expect(result.maxPages).toBe(100);
      expect(result.delayBetweenRequests).toBe(200);
    });

    it('should accept custom values', () => {
      const result = PaginationOptionsSchema.parse({
        startPage: 2,
        pageSize: 50,
        maxRecords: 500,
        maxPages: 10,
        delayBetweenRequests: 100,
      });

      expect(result.startPage).toBe(2);
      expect(result.pageSize).toBe(50);
      expect(result.maxRecords).toBe(500);
      expect(result.maxPages).toBe(10);
      expect(result.delayBetweenRequests).toBe(100);
    });

    it('should reject invalid pageSize', () => {
      expect(() =>
        PaginationOptionsSchema.parse({ pageSize: 150 })
      ).toThrow();
    });
  });

  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await delay(50);
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(40);
    });
  });

  describe('formatDate', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toBe('2024-01-15');
    });

    it('should pad month and day with zeros', () => {
      const date = new Date('2024-03-05');
      expect(formatDate(date)).toBe('2024-03-05');
    });
  });

  describe('splitDateRange', () => {
    it('should split date range into chunks', () => {
      const ranges = splitDateRange('2024-01-01', '2024-03-31', 31);

      expect(ranges.length).toBe(3);
      expect(ranges[0].start).toBe('2024-01-01');
      expect(ranges[0].end).toBe('2024-01-31');
      expect(ranges[1].start).toBe('2024-02-01');
    });

    it('should handle single day range', () => {
      const ranges = splitDateRange('2024-01-15', '2024-01-15', 31);

      expect(ranges.length).toBe(1);
      expect(ranges[0].start).toBe('2024-01-15');
      expect(ranges[0].end).toBe('2024-01-15');
    });

    it('should return empty array for invalid date range', () => {
      const ranges = splitDateRange('2024-01-31', '2024-01-01', 31);

      expect(ranges.length).toBe(0);
    });

    it('should return empty array for invalid dates', () => {
      const ranges = splitDateRange('invalid', '2024-01-31', 31);

      expect(ranges.length).toBe(0);
    });

    it('should handle custom chunk size', () => {
      const ranges = splitDateRange('2024-01-01', '2024-01-10', 5);

      expect(ranges.length).toBe(2);
      expect(ranges[0].end).toBe('2024-01-05');
      expect(ranges[1].start).toBe('2024-01-06');
      expect(ranges[1].end).toBe('2024-01-10');
    });
  });

  describe('removeDuplicates', () => {
    it('should remove duplicate records by ID', () => {
      const records: ZaimMoney[] = [
        createMockRecord(1, '2024-01-15'),
        createMockRecord(2, '2024-01-16'),
        createMockRecord(1, '2024-01-15'), // duplicate
      ];

      const result = removeDuplicates(records);

      expect(result.length).toBe(2);
      expect(result.map(r => r.id)).toEqual([1, 2]);
    });

    it('should preserve order of first occurrences', () => {
      const records: ZaimMoney[] = [
        createMockRecord(3, '2024-01-17'),
        createMockRecord(1, '2024-01-15'),
        createMockRecord(2, '2024-01-16'),
        createMockRecord(1, '2024-01-15'), // duplicate
      ];

      const result = removeDuplicates(records);

      expect(result.length).toBe(3);
      expect(result.map(r => r.id)).toEqual([3, 1, 2]);
    });

    it('should return empty array for empty input', () => {
      const result = removeDuplicates([]);

      expect(result.length).toBe(0);
    });
  });

  describe('fetchAllRecords', () => {
    it('should fetch all pages of records', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce([
          createMockRecord(1, '2024-01-15'),
          createMockRecord(2, '2024-01-16'),
        ])
        .mockResolvedValueOnce([
          createMockRecord(3, '2024-01-17'),
        ]);

      const result = await fetchAllRecords(mockFetch, {}, {
        pageSize: 2,
        delayBetweenRequests: 0,
      });

      expect(result.records.length).toBe(3);
      expect(result.pagesRetrieved).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(result.hasError).toBe(false);
    });

    it('should respect maxRecords limit', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce([
          createMockRecord(1, '2024-01-15'),
          createMockRecord(2, '2024-01-16'),
        ])
        .mockResolvedValueOnce([
          createMockRecord(3, '2024-01-17'),
          createMockRecord(4, '2024-01-18'),
        ]);

      const result = await fetchAllRecords(mockFetch, {}, {
        pageSize: 2,
        maxRecords: 3,
        delayBetweenRequests: 0,
      });

      expect(result.records.length).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should respect maxPages limit', async () => {
      const mockFetch = vi.fn().mockResolvedValue([
        createMockRecord(1, '2024-01-15'),
        createMockRecord(2, '2024-01-16'),
      ]);

      const result = await fetchAllRecords(mockFetch, {}, {
        pageSize: 2,
        maxPages: 2,
        delayBetweenRequests: 0,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.hasMore).toBe(true);
    });

    it('should handle API errors', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce([createMockRecord(1, '2024-01-15')])
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await fetchAllRecords(mockFetch, {}, {
        pageSize: 1,
        delayBetweenRequests: 0,
      });

      expect(result.hasError).toBe(true);
      expect(result.errorMessage).toBe('API Error');
      expect(result.records.length).toBe(1);
    });
  });

  describe('fetchByDateRanges', () => {
    it('should fetch data across date ranges', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce([createMockRecord(1, '2024-01-15')])
        .mockResolvedValueOnce([createMockRecord(2, '2024-02-15')]);

      const result = await fetchByDateRanges(
        mockFetch,
        '2024-01-01',
        '2024-02-28',
        {},
        { pageSize: 100, delayBetweenRequests: 0 }
      );

      expect(result.records.length).toBe(2);
      expect(result.hasError).toBe(false);
    });

    it('should return empty result for invalid date range', async () => {
      const mockFetch = vi.fn();

      const result = await fetchByDateRanges(
        mockFetch,
        '2024-02-01',
        '2024-01-01',
        {},
        {}
      );

      expect(result.records.length).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should remove duplicates from fetched data', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce([
          createMockRecord(1, '2024-01-15'),
          createMockRecord(2, '2024-01-16'),
        ])
        .mockResolvedValueOnce([
          createMockRecord(1, '2024-01-15'), // duplicate
          createMockRecord(3, '2024-02-15'),
        ]);

      const result = await fetchByDateRanges(
        mockFetch,
        '2024-01-01',
        '2024-02-28',
        {},
        { pageSize: 100, delayBetweenRequests: 0 }
      );

      expect(result.records.length).toBe(3);
    });

    it('should respect maxRecords across date ranges', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce([
          createMockRecord(1, '2024-01-15'),
          createMockRecord(2, '2024-01-16'),
        ])
        .mockResolvedValueOnce([
          createMockRecord(3, '2024-02-15'),
          createMockRecord(4, '2024-02-16'),
        ]);

      const result = await fetchByDateRanges(
        mockFetch,
        '2024-01-01',
        '2024-02-28',
        {},
        { pageSize: 100, maxRecords: 3, delayBetweenRequests: 0 }
      );

      expect(result.records.length).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should handle errors in date range fetching', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce([createMockRecord(1, '2024-01-15')])
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await fetchByDateRanges(
        mockFetch,
        '2024-01-01',
        '2024-02-28',
        {},
        { pageSize: 100, delayBetweenRequests: 0 }
      );

      expect(result.hasError).toBe(true);
      expect(result.records.length).toBe(1);
    });
  });

  describe('estimateRecordCount', () => {
    it('should return exact count when less than sample size', async () => {
      const mockFetch = vi.fn().mockResolvedValue([
        createMockRecord(1, '2024-01-15'),
      ]);

      const result = await estimateRecordCount(mockFetch, {}, 10);

      expect(result.count).toBe(1);
      expect(result.isExact).toBe(true);
    });

    it('should return non-exact count when equal to sample size', async () => {
      const mockFetch = vi.fn().mockResolvedValue([
        createMockRecord(1, '2024-01-15'),
        createMockRecord(2, '2024-01-16'),
      ]);

      const result = await estimateRecordCount(mockFetch, {}, 2);

      expect(result.count).toBe(2);
      expect(result.isExact).toBe(false);
    });
  });
});
