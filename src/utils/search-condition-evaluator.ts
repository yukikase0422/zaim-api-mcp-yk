/**
 * 検索条件評価エンジン
 *
 * Zaim APIから取得したレコードに対して、複合的な検索条件を評価し、
 * 条件に合致するレコードをフィルタリングする機能を提供する。
 */

import {
  SearchCondition,
  CompositeCondition,
  SearchCriteria,
  StringCondition,
  NumberCondition,
  DateCondition,
  ModeCondition,
  OutputControl,
  OutputField,
  isCompositeCondition,
  isStringCondition,
  isNumberCondition,
  isDateCondition,
  isModeCondition,
} from '../types/advanced-search.js';
import { ZaimMoney } from '../types/zaim-api.js';

/**
 * フォーマット済みレコードの型
 * IDのみの場合はnumber、それ以外はオブジェクト
 */
export type FormattedRecord = number | Partial<ZaimMoney>;

/**
 * 出力フォーマット結果
 */
export interface FormatOutputResult {
  /** フォーマット済みレコード */
  records: FormattedRecord[];
  /** 出力された件数 */
  count: number;
  /** 文字数制限により切り捨てられたか */
  truncated: boolean;
  /** 切り捨てられた件数 */
  truncatedCount: number;
}

/**
 * 文字列条件を評価する
 *
 * @param record - 評価対象のレコード
 * @param condition - 文字列検索条件
 * @returns 条件に合致する場合はtrue
 */
export function evaluateStringCondition(
  record: ZaimMoney,
  condition: StringCondition
): boolean {
  const fieldValue = record[condition.field as keyof ZaimMoney];

  // フィールドが存在しない場合はfalse
  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  // 文字列に変換
  const valueStr = String(fieldValue);
  const searchValue = condition.caseSensitive
    ? condition.value
    : condition.value.toLowerCase();
  const compareValue = condition.caseSensitive
    ? valueStr
    : valueStr.toLowerCase();

  switch (condition.operator) {
    case 'equals':
      return compareValue === searchValue;
    case 'contains':
      return compareValue.includes(searchValue);
    case 'startsWith':
      return compareValue.startsWith(searchValue);
    case 'endsWith':
      return compareValue.endsWith(searchValue);
    default:
      return false;
  }
}

/**
 * 数値条件を評価する
 *
 * @param record - 評価対象のレコード
 * @param condition - 数値検索条件
 * @returns 条件に合致する場合はtrue
 */
export function evaluateNumberCondition(
  record: ZaimMoney,
  condition: NumberCondition
): boolean {
  const fieldValue = record[condition.field as keyof ZaimMoney];

  // フィールドが存在しない場合はfalse
  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  const numValue = Number(fieldValue);

  // 数値に変換できない場合はfalse
  if (isNaN(numValue)) {
    return false;
  }

  switch (condition.operator) {
    case 'equals':
      return numValue === condition.value;
    case 'notEquals':
      return numValue !== condition.value;
    case 'greaterThan':
      return condition.value !== undefined && numValue > condition.value;
    case 'lessThan':
      return condition.value !== undefined && numValue < condition.value;
    case 'greaterOrEqual':
      return condition.value !== undefined && numValue >= condition.value;
    case 'lessOrEqual':
      return condition.value !== undefined && numValue <= condition.value;
    case 'between':
      if (condition.min === undefined || condition.max === undefined) {
        return false;
      }
      return numValue >= condition.min && numValue <= condition.max;
    default:
      return false;
  }
}

/**
 * 日付条件を評価する
 *
 * @param record - 評価対象のレコード
 * @param condition - 日付検索条件
 * @returns 条件に合致する場合はtrue
 */
export function evaluateDateCondition(
  record: ZaimMoney,
  condition: DateCondition
): boolean {
  const fieldValue = record.date;

  // フィールドが存在しない場合はfalse
  if (!fieldValue) {
    return false;
  }

  // 日付文字列を比較用に正規化（YYYY-MM-DD形式）
  const recordDate = fieldValue.slice(0, 10);

  switch (condition.operator) {
    case 'equals':
      return condition.value !== undefined && recordDate === condition.value;
    case 'before':
      return condition.value !== undefined && recordDate < condition.value;
    case 'after':
      return condition.value !== undefined && recordDate > condition.value;
    case 'onOrBefore':
      return condition.value !== undefined && recordDate <= condition.value;
    case 'onOrAfter':
      return condition.value !== undefined && recordDate >= condition.value;
    case 'between':
      if (condition.startDate === undefined || condition.endDate === undefined) {
        return false;
      }
      return recordDate >= condition.startDate && recordDate <= condition.endDate;
    default:
      return false;
  }
}

/**
 * モード条件を評価する
 *
 * @param record - 評価対象のレコード
 * @param condition - モード検索条件
 * @returns 条件に合致する場合はtrue
 */
export function evaluateModeCondition(
  record: ZaimMoney,
  condition: ModeCondition
): boolean {
  return record.mode === condition.value;
}

/**
 * 単一の検索条件を評価する
 *
 * @param record - 評価対象のレコード
 * @param condition - 検索条件
 * @returns 条件に合致する場合はtrue
 */
export function evaluateCondition(
  record: ZaimMoney,
  condition: SearchCondition
): boolean {
  if (isStringCondition(condition)) {
    return evaluateStringCondition(record, condition);
  }

  if (isNumberCondition(condition)) {
    return evaluateNumberCondition(record, condition);
  }

  if (isDateCondition(condition)) {
    return evaluateDateCondition(record, condition);
  }

  if (isModeCondition(condition)) {
    return evaluateModeCondition(record, condition);
  }

  return false;
}

/**
 * 複合検索条件を評価する（再帰的）
 *
 * @param record - 評価対象のレコード
 * @param composite - 複合検索条件
 * @returns 条件に合致する場合はtrue
 */
export function evaluateCompositeCondition(
  record: ZaimMoney,
  composite: CompositeCondition
): boolean {
  const { operator, conditions } = composite;

  if (conditions.length === 0) {
    return true; // 空の条件は常にtrue
  }

  if (operator === 'AND') {
    // AND: すべての条件が真である必要がある
    return conditions.every((cond) => {
      if (isCompositeCondition(cond)) {
        return evaluateCompositeCondition(record, cond);
      }
      return evaluateCondition(record, cond);
    });
  } else {
    // OR: いずれかの条件が真であればよい
    return conditions.some((cond) => {
      if (isCompositeCondition(cond)) {
        return evaluateCompositeCondition(record, cond);
      }
      return evaluateCondition(record, cond);
    });
  }
}

/**
 * 検索条件（単一または複合）を評価する
 *
 * @param record - 評価対象のレコード
 * @param criteria - 検索条件
 * @returns 条件に合致する場合はtrue
 */
export function evaluateCriteria(
  record: ZaimMoney,
  criteria: SearchCriteria
): boolean {
  if (isCompositeCondition(criteria)) {
    return evaluateCompositeCondition(record, criteria);
  }
  return evaluateCondition(record, criteria);
}

/**
 * レコード配列をフィルタリングする
 *
 * @param records - フィルタリング対象のレコード配列
 * @param criteria - 検索条件
 * @returns 条件に合致するレコードの配列
 */
export function filterRecords(
  records: ZaimMoney[],
  criteria: SearchCriteria
): ZaimMoney[] {
  return records.filter((record) => evaluateCriteria(record, criteria));
}

/**
 * レコードをソートする（要件に基づく固定ソート順）
 * 1. 日付（新しい順）
 * 2. 店舗名（place）順
 * 3. 品目名（name）順
 *
 * @param records - ソート対象のレコード配列
 * @returns ソート済みのレコード配列
 */
export function sortRecords(records: ZaimMoney[]): ZaimMoney[] {
  return [...records].sort((a, b) => {
    // 1. 日付（新しい順 = 降順）
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    // 2. 店舗名（place）順（昇順）
    const placeA = a.place || '';
    const placeB = b.place || '';
    const placeCompare = placeA.localeCompare(placeB, 'ja');
    if (placeCompare !== 0) {
      return placeCompare;
    }

    // 3. 品目名（name）順（昇順）
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB, 'ja');
  });
}

/**
 * 検索・ソート・件数制限を一括で行う
 *
 * @param records - 処理対象のレコード配列
 * @param criteria - 検索条件
 * @param maxRecords - 最大取得件数（オプション）
 * @returns 処理済みのレコード配列
 */
export function searchAndSort(
  records: ZaimMoney[],
  criteria: SearchCriteria,
  maxRecords?: number
): ZaimMoney[] {
  // フィルタリング
  let result = filterRecords(records, criteria);

  // ソート
  result = sortRecords(result);

  // 件数制限
  if (maxRecords !== undefined && maxRecords > 0) {
    result = result.slice(0, maxRecords);
  }

  return result;
}

/**
 * 単一のレコードを指定フィールドのみに絞り込む
 *
 * @param record - 元のレコード
 * @param fields - 出力するフィールドの配列
 * @returns 指定フィールドのみを含むオブジェクト
 */
function pickFields(record: ZaimMoney, fields: OutputField[]): Partial<ZaimMoney> {
  const result: Partial<ZaimMoney> = {};

  for (const field of fields) {
    if (field in record) {
      // 型安全のためキャストを行う
      (result as Record<string, unknown>)[field] = (record as Record<string, unknown>)[field];
    }
  }

  return result;
}

/**
 * レコードをJSON文字列化し、文字数制限を適用する
 *
 * @param record - フォーマット対象のレコード（IDまたはオブジェクト）
 * @param maxChars - 最大文字数（未指定時は制限なし）
 * @returns 文字数制限を適用したJSON文字列
 */
function stringifyWithLimit(record: FormattedRecord, maxChars?: number): string {
  const json = JSON.stringify(record);

  if (maxChars === undefined || json.length <= maxChars) {
    return json;
  }

  // 文字数制限を超えた場合は切り詰めて「...」を追加
  return json.slice(0, maxChars - 3) + '...';
}

/**
 * レコード配列を出力制御設定に基づいてフォーマットする
 *
 * 出力モードに応じて以下の処理を行う：
 * - id_only: IDのみの配列を返す
 * - specified: 指定フィールドのみを含むオブジェクト配列を返す
 * - full: 全フィールドを含むオブジェクト配列を返す
 *
 * また、以下の制限を適用する：
 * - maxCharsPerRecord: 1件あたりの最大文字数
 * - maxTotalChars: 全体の最大文字数
 *
 * @param records - フォーマット対象のレコード配列
 * @param outputControl - 出力制御設定
 * @returns フォーマット結果
 */
export function formatOutput(
  records: ZaimMoney[],
  outputControl?: OutputControl
): FormatOutputResult {
  // デフォルト値を適用
  const mode = outputControl?.mode ?? 'full';
  const fields = outputControl?.fields;
  const maxCharsPerRecord = outputControl?.maxCharsPerRecord;
  const maxTotalChars = outputControl?.maxTotalChars;

  // フォーマット済みレコードを格納する配列
  const formattedRecords: FormattedRecord[] = [];
  let totalChars = 0;
  let truncated = false;
  let truncatedCount = 0;

  for (const record of records) {
    let formattedRecord: FormattedRecord;

    // 出力モードに応じてレコードを変換
    switch (mode) {
      case 'id_only':
        // IDのみを出力
        formattedRecord = record.id;
        break;

      case 'specified':
        // 指定フィールドのみを出力
        if (fields && fields.length > 0) {
          formattedRecord = pickFields(record, fields);
        } else {
          // フィールド指定がない場合は全フィールド
          formattedRecord = record;
        }
        break;

      case 'full':
      default:
        // 全フィールドを出力
        formattedRecord = record;
        break;
    }

    // 文字列化して文字数をカウント
    const recordStr = stringifyWithLimit(formattedRecord, maxCharsPerRecord);
    const recordChars = recordStr.length;

    // 全体の文字数制限をチェック
    if (maxTotalChars !== undefined && totalChars + recordChars > maxTotalChars) {
      truncated = true;
      truncatedCount = records.length - formattedRecords.length;
      break;
    }

    formattedRecords.push(formattedRecord);
    totalChars += recordChars;
  }

  return {
    records: formattedRecords,
    count: formattedRecords.length,
    truncated,
    truncatedCount,
  };
}
