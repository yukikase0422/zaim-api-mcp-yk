import { z } from 'zod';

/**
 * 検索可能なフィールド名
 */
export const SearchFieldSchema = z.enum([
  'id',
  'mode',
  'date',
  'category_id',
  'genre_id',
  'account_id',
  'from_account_id',
  'to_account_id',
  'amount',
  'place',
  'name',
  'comment',
  'category',
  'genre',
  'account',
]);

export type SearchField = z.infer<typeof SearchFieldSchema>;

/**
 * 文字列比較演算子
 */
export const StringOperatorSchema = z.enum([
  'equals',      // 完全一致
  'contains',    // 部分一致
  'startsWith',  // 前方一致
  'endsWith',    // 後方一致
]);

export type StringOperator = z.infer<typeof StringOperatorSchema>;

/**
 * 数値比較演算子
 */
export const NumberOperatorSchema = z.enum([
  'equals',        // 等しい
  'notEquals',     // 等しくない
  'greaterThan',   // より大きい
  'lessThan',      // より小さい
  'greaterOrEqual', // 以上
  'lessOrEqual',   // 以下
  'between',       // 範囲内（min <= value <= max）
]);

export type NumberOperator = z.infer<typeof NumberOperatorSchema>;

/**
 * 日付比較演算子
 */
export const DateOperatorSchema = z.enum([
  'equals',        // 等しい
  'before',        // より前
  'after',         // より後
  'between',       // 範囲内
  'onOrBefore',    // 以前
  'onOrAfter',     // 以降
]);

export type DateOperator = z.infer<typeof DateOperatorSchema>;

/**
 * 単一検索条件（文字列フィールド用）
 */
export const StringConditionSchema = z.object({
  /** 検索対象フィールド */
  field: z.enum(['place', 'name', 'comment', 'category', 'genre', 'account']),
  /** 比較演算子 */
  operator: StringOperatorSchema,
  /** 検索値 */
  value: z.string(),
  /** 大文字小文字を区別するか（デフォルト: false） */
  caseSensitive: z.boolean().optional(),
}).strict();

export type StringCondition = z.infer<typeof StringConditionSchema>;

/**
 * 単一検索条件（数値フィールド用）
 */
export const NumberConditionSchema = z.object({
  /** 検索対象フィールド */
  field: z.enum(['id', 'category_id', 'genre_id', 'account_id', 'from_account_id', 'to_account_id', 'amount']),
  /** 比較演算子 */
  operator: NumberOperatorSchema,
  /** 検索値（between以外の場合） */
  value: z.number().optional(),
  /** 最小値（between用） */
  min: z.number().optional(),
  /** 最大値（between用） */
  max: z.number().optional(),
}).strict();

export type NumberCondition = z.infer<typeof NumberConditionSchema>;

/**
 * 単一検索条件（日付フィールド用）
 */
export const DateConditionSchema = z.object({
  /** 検索対象フィールド */
  field: z.literal('date'),
  /** 比較演算子 */
  operator: DateOperatorSchema,
  /** 検索値（YYYY-MM-DD形式、between以外の場合） */
  value: z.string().optional(),
  /** 開始日（YYYY-MM-DD形式、between用） */
  startDate: z.string().optional(),
  /** 終了日（YYYY-MM-DD形式、between用） */
  endDate: z.string().optional(),
}).strict();

export type DateCondition = z.infer<typeof DateConditionSchema>;

/**
 * 単一検索条件（モードフィールド用）
 */
export const ModeConditionSchema = z.object({
  /** 検索対象フィールド */
  field: z.literal('mode'),
  /** 比較演算子 */
  operator: z.literal('equals'),
  /** 検索値 */
  value: z.enum(['payment', 'income', 'transfer']),
}).strict();

export type ModeCondition = z.infer<typeof ModeConditionSchema>;

/**
 * 単一検索条件（全タイプ）
 */
export const SearchConditionSchema = z.union([
  StringConditionSchema,
  NumberConditionSchema,
  DateConditionSchema,
  ModeConditionSchema,
]);

export type SearchCondition = z.infer<typeof SearchConditionSchema>;

/**
 * 論理演算子
 */
export const LogicalOperatorSchema = z.enum(['AND', 'OR']);

export type LogicalOperator = z.infer<typeof LogicalOperatorSchema>;

/**
 * 複合検索条件（AND/OR）
 * 再帰的な構造を持ち、括弧によるグループ化をサポート
 */
export const CompositeConditionSchema: z.ZodType<CompositeCondition> = z.lazy(() =>
  z.object({
    /** 論理演算子 */
    operator: LogicalOperatorSchema,
    /** 条件リスト（単一条件または複合条件の配列） */
    conditions: z.array(z.union([SearchConditionSchema, CompositeConditionSchema])),
  }).strict()
);

export type CompositeCondition = {
  operator: LogicalOperator;
  conditions: (SearchCondition | CompositeCondition)[];
};

/**
 * 検索条件（単一または複合）
 */
export const SearchCriteriaSchema = z.union([
  SearchConditionSchema,
  CompositeConditionSchema,
]);

export type SearchCriteria = SearchCondition | CompositeCondition;

/**
 * 出力フィールドの指定
 */
export const OutputFieldSchema = z.enum([
  'id',
  'mode',
  'user_id',
  'date',
  'category_id',
  'genre_id',
  'account_id',
  'from_account_id',
  'to_account_id',
  'amount',
  'place',
  'name',
  'comment',
  'active',
  'created',
  'currency_code',
  'category',
  'genre',
  'account',
]);

export type OutputField = z.infer<typeof OutputFieldSchema>;

/**
 * 出力モード
 */
export const OutputModeSchema = z.enum([
  'id_only',       // IDのみ出力
  'specified',     // 指定フィールドのみ出力
  'full',          // 全フィールド出力
]);

export type OutputMode = z.infer<typeof OutputModeSchema>;

/**
 * 出力制御設定
 */
export const OutputControlSchema = z.object({
  /** 出力モード */
  mode: OutputModeSchema.optional().default('full'),
  /** 出力するフィールド（mode='specified'の場合に使用） */
  fields: z.array(OutputFieldSchema).optional(),
  /** 1件あたりの最大文字数（超えた場合はカット） */
  maxCharsPerRecord: z.number().positive().optional(),
  /** 全体の最大文字数 */
  maxTotalChars: z.number().positive().optional(),
  /** 最大取得件数 */
  maxRecords: z.number().positive().optional(),
}).strict();

export type OutputControl = z.infer<typeof OutputControlSchema>;

/**
 * 文字列フィールドの更新方式
 */
export const StringUpdateModeSchema = z.enum([
  'replace',       // 完全置換
  'partial',       // 部分置換
]);

export type StringUpdateMode = z.infer<typeof StringUpdateModeSchema>;

/**
 * 文字列フィールドの更新内容
 */
export const StringUpdateSchema = z.object({
  /** 更新方式 */
  mode: StringUpdateModeSchema,
  /** 新しい値（mode='replace'の場合） */
  newValue: z.string().optional(),
  /** 検索文字列（mode='partial'の場合） */
  searchPattern: z.string().optional(),
  /** 置換文字列（mode='partial'の場合、省略時は削除） */
  replaceWith: z.string().optional(),
}).strict();

export type StringUpdate = z.infer<typeof StringUpdateSchema>;

/**
 * 一括更新用フィールド
 */
export const UpdateFieldsSchema = z.object({
  /** カテゴリID */
  category_id: z.number().optional(),
  /** ジャンルID */
  genre_id: z.number().optional(),
  /** 日付（YYYY-MM-DD形式） */
  date: z.string().optional(),
  /** 金額 */
  amount: z.number().optional(),
  /** 店舗名 */
  place: StringUpdateSchema.optional(),
  /** 品目名 */
  name: StringUpdateSchema.optional(),
  /** 口座ID */
  account_id: z.number().optional(),
  /** 振替元口座ID */
  from_account_id: z.number().optional(),
  /** 振替先口座ID */
  to_account_id: z.number().optional(),
  /** コメント */
  comment: StringUpdateSchema.optional(),
}).strict();

export type UpdateFields = z.infer<typeof UpdateFieldsSchema>;

/**
 * 高度検索ツールの入力
 */
export const AdvancedSearchInputSchema = z.object({
  /** 検索条件 */
  criteria: SearchCriteriaSchema,
  /** 出力制御 */
  output: OutputControlSchema.optional(),
}).strict();

export type AdvancedSearchInput = z.infer<typeof AdvancedSearchInputSchema>;

/**
 * 一括更新ツールの入力
 */
export const BulkUpdateInputSchema = z.object({
  /** 検索条件 */
  criteria: SearchCriteriaSchema,
  /** 更新内容 */
  updates: UpdateFieldsSchema,
  /** 対象件数の確認（安全策として必須） */
  expectedCount: z.number().positive(),
}).strict();

export type BulkUpdateInput = z.infer<typeof BulkUpdateInputSchema>;

/**
 * 一括削除ツールの入力
 */
export const BulkDeleteInputSchema = z.object({
  /** 検索条件 */
  criteria: SearchCriteriaSchema,
  /** 対象件数の確認（安全策として必須） */
  expectedCount: z.number().positive(),
}).strict();

export type BulkDeleteInput = z.infer<typeof BulkDeleteInputSchema>;

/**
 * 複合条件かどうかを判定するヘルパー関数
 */
export function isCompositeCondition(
  criteria: SearchCriteria
): criteria is CompositeCondition {
  return 'operator' in criteria &&
         (criteria.operator === 'AND' || criteria.operator === 'OR') &&
         'conditions' in criteria;
}

/**
 * 文字列条件かどうかを判定するヘルパー関数
 */
export function isStringCondition(
  condition: SearchCondition
): condition is StringCondition {
  const stringFields = ['place', 'name', 'comment', 'category', 'genre', 'account'];
  return stringFields.includes(condition.field);
}

/**
 * 数値条件かどうかを判定するヘルパー関数
 */
export function isNumberCondition(
  condition: SearchCondition
): condition is NumberCondition {
  const numberFields = ['id', 'category_id', 'genre_id', 'account_id', 'from_account_id', 'to_account_id', 'amount'];
  return numberFields.includes(condition.field);
}

/**
 * 日付条件かどうかを判定するヘルパー関数
 */
export function isDateCondition(
  condition: SearchCondition
): condition is DateCondition {
  return condition.field === 'date';
}

/**
 * モード条件かどうかを判定するヘルパー関数
 */
export function isModeCondition(
  condition: SearchCondition
): condition is ModeCondition {
  return condition.field === 'mode';
}
