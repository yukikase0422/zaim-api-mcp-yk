/**
 * ページネーションヘルパー
 *
 * Zaim APIの取得件数制限を超えたデータを取得するための
 * 自動ページネーション機能を提供する。
 */

import { z } from 'zod';
import { ZaimMoney, MoneySearchParams } from '../types/zaim-api.js';

/**
 * ページネーションオプション
 */
export const PaginationOptionsSchema = z.object({
  /** 開始ページ（1始まり、デフォルト: 1） */
  startPage: z.number().positive().optional().default(1),
  /** 1ページあたりの件数（最大100、デフォルト: 100） */
  pageSize: z.number().positive().max(100).optional().default(100),
  /** 最大取得件数（未指定の場合は全件取得） */
  maxRecords: z.number().positive().optional(),
  /** 最大ページ数（安全策、デフォルト: 100） */
  maxPages: z.number().positive().optional().default(100),
  /** リクエスト間の待機時間（ミリ秒、デフォルト: 200） */
  delayBetweenRequests: z.number().nonnegative().optional().default(200),
}).strict();

export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>;

/**
 * ページネーション結果
 */
export interface PaginationResult<T> {
  /** 取得したレコード */
  records: T[];
  /** 取得したページ数 */
  pagesRetrieved: number;
  /** 総取得件数 */
  totalRecords: number;
  /** さらにレコードが存在する可能性があるか */
  hasMore: boolean;
  /** エラーが発生したか */
  hasError: boolean;
  /** エラーメッセージ（エラー発生時） */
  errorMessage?: string;
}

/**
 * APIからデータを取得する関数の型
 */
export type FetchFunction<T> = (params: MoneySearchParams) => Promise<T[]>;

/**
 * 遅延を挿入するユーティリティ関数
 *
 * @param ms - 待機時間（ミリ秒）
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 全件取得を行う（自動ページネーション）
 *
 * API制限を超えた件数のデータを取得するため、
 * 自動的にページを進めながらデータを収集する。
 *
 * @param fetchFn - データ取得関数
 * @param baseParams - 基本検索パラメータ
 * @param options - ページネーションオプション
 * @returns ページネーション結果
 */
export async function fetchAllRecords(
  fetchFn: FetchFunction<ZaimMoney>,
  baseParams: Omit<MoneySearchParams, 'page' | 'limit'>,
  options: Partial<PaginationOptions> = {}
): Promise<PaginationResult<ZaimMoney>> {
  // オプションのデフォルト値を適用
  const opts = PaginationOptionsSchema.parse(options);

  const allRecords: ZaimMoney[] = [];
  let currentPage = opts.startPage;
  let hasMore = true;
  let hasError = false;
  let errorMessage: string | undefined;

  try {
    while (hasMore) {
      // 最大ページ数チェック
      if (currentPage - opts.startPage + 1 > opts.maxPages) {
        hasMore = true; // まだデータがある可能性を示す
        break;
      }

      // 最大取得件数チェック
      if (opts.maxRecords !== undefined && allRecords.length >= opts.maxRecords) {
        hasMore = true; // まだデータがある可能性を示す
        break;
      }

      // APIリクエストパラメータを構築
      const params: MoneySearchParams = {
        ...baseParams,
        page: currentPage,
        limit: opts.pageSize,
      };

      // APIを呼び出し
      const records = await fetchFn(params);

      // 取得結果を追加
      allRecords.push(...records);

      // 次のページがあるかチェック
      if (records.length < opts.pageSize) {
        hasMore = false;
      } else {
        currentPage++;

        // レート制限対策として待機
        if (opts.delayBetweenRequests > 0) {
          await delay(opts.delayBetweenRequests);
        }
      }
    }

    // 最大取得件数を超えた分を切り捨て
    let finalRecords = allRecords;
    if (opts.maxRecords !== undefined && allRecords.length > opts.maxRecords) {
      finalRecords = allRecords.slice(0, opts.maxRecords);
      hasMore = true;
    }

    return {
      records: finalRecords,
      pagesRetrieved: currentPage - opts.startPage + 1,
      totalRecords: finalRecords.length,
      hasMore,
      hasError: false,
    };
  } catch (error) {
    hasError = true;
    errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      records: allRecords,
      pagesRetrieved: currentPage - opts.startPage + 1,
      totalRecords: allRecords.length,
      hasMore: true,
      hasError: true,
      errorMessage,
    };
  }
}

/**
 * 日付範囲を指定期間ごとに分割する
 *
 * 大きな日付範囲を小さな期間に分割し、
 * それぞれの期間に対してAPIリクエストを行うことで、
 * APIの制限を回避する。
 *
 * @param startDate - 開始日（YYYY-MM-DD形式）
 * @param endDate - 終了日（YYYY-MM-DD形式）
 * @param daysPerChunk - 1チャンクあたりの日数（デフォルト: 31）
 * @returns 日付範囲の配列
 */
export function splitDateRange(
  startDate: string,
  endDate: string,
  daysPerChunk: number = 31
): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  // 日付が不正な場合は空配列を返す
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }

  let currentStart = new Date(start);

  while (currentStart <= end) {
    // チャンクの終了日を計算
    const chunkEnd = new Date(currentStart);
    chunkEnd.setDate(chunkEnd.getDate() + daysPerChunk - 1);

    // 終了日を超えないように調整
    const actualEnd = chunkEnd > end ? end : chunkEnd;

    ranges.push({
      start: formatDate(currentStart),
      end: formatDate(actualEnd),
    });

    // 次のチャンクの開始日
    currentStart = new Date(actualEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return ranges;
}

/**
 * 日付をYYYY-MM-DD形式にフォーマットする
 *
 * @param date - Date オブジェクト
 * @returns YYYY-MM-DD形式の文字列
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付範囲ごとにデータを取得し、結合する
 *
 * 大きな日付範囲を分割して取得することで、
 * APIの制限を回避しつつ全データを取得する。
 *
 * @param fetchFn - データ取得関数
 * @param startDate - 開始日（YYYY-MM-DD形式）
 * @param endDate - 終了日（YYYY-MM-DD形式）
 * @param baseParams - その他の検索パラメータ
 * @param options - ページネーションオプション
 * @returns ページネーション結果
 */
export async function fetchByDateRanges(
  fetchFn: FetchFunction<ZaimMoney>,
  startDate: string,
  endDate: string,
  baseParams: Omit<MoneySearchParams, 'page' | 'limit' | 'start_date' | 'end_date'>,
  options: Partial<PaginationOptions> = {}
): Promise<PaginationResult<ZaimMoney>> {
  const ranges = splitDateRange(startDate, endDate);

  if (ranges.length === 0) {
    return {
      records: [],
      pagesRetrieved: 0,
      totalRecords: 0,
      hasMore: false,
      hasError: false,
    };
  }

  const allRecords: ZaimMoney[] = [];
  let totalPagesRetrieved = 0;
  let hasError = false;
  let errorMessage: string | undefined;

  for (const range of ranges) {
    const params: Omit<MoneySearchParams, 'page' | 'limit'> = {
      ...baseParams,
      start_date: range.start,
      end_date: range.end,
    };

    const result = await fetchAllRecords(fetchFn, params, options);

    allRecords.push(...result.records);
    totalPagesRetrieved += result.pagesRetrieved;

    if (result.hasError) {
      hasError = true;
      errorMessage = result.errorMessage;
      break;
    }

    // 最大取得件数チェック
    if (options.maxRecords !== undefined && allRecords.length >= options.maxRecords) {
      break;
    }
  }

  // 最大取得件数を超えた分を切り捨て
  let finalRecords = allRecords;
  let hasMore = false;
  if (options.maxRecords !== undefined && allRecords.length > options.maxRecords) {
    finalRecords = allRecords.slice(0, options.maxRecords);
    hasMore = true;
  }

  // 重複を除去（IDベース）
  const uniqueRecords = removeDuplicates(finalRecords);

  return {
    records: uniqueRecords,
    pagesRetrieved: totalPagesRetrieved,
    totalRecords: uniqueRecords.length,
    hasMore,
    hasError,
    errorMessage,
  };
}

/**
 * レコードの重複を除去する（IDベース）
 *
 * @param records - レコード配列
 * @returns 重複を除去したレコード配列
 */
export function removeDuplicates(records: ZaimMoney[]): ZaimMoney[] {
  const seen = new Set<number>();
  return records.filter((record) => {
    if (seen.has(record.id)) {
      return false;
    }
    seen.add(record.id);
    return true;
  });
}

/**
 * レコード数をカウントするための軽量な取得
 *
 * 最小限のデータを取得してレコード数を推定する。
 *
 * @param fetchFn - データ取得関数
 * @param baseParams - 基本検索パラメータ
 * @param sampleSize - サンプルサイズ（デフォルト: 1）
 * @returns 推定レコード数（正確ではない場合がある）
 */
export async function estimateRecordCount(
  fetchFn: FetchFunction<ZaimMoney>,
  baseParams: Omit<MoneySearchParams, 'page' | 'limit'>,
  sampleSize: number = 1
): Promise<{ count: number; isExact: boolean }> {
  const params: MoneySearchParams = {
    ...baseParams,
    page: 1,
    limit: sampleSize,
  };

  const records = await fetchFn(params);

  if (records.length < sampleSize) {
    // サンプルサイズより少ない場合は正確な件数
    return { count: records.length, isExact: true };
  }

  // サンプルサイズ以上の場合は推定値
  return { count: records.length, isExact: false };
}
