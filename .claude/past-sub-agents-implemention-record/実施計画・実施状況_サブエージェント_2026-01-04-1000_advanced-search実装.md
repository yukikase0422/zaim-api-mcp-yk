# 実施計画・実施状況：zaim_advanced_searchツール実装

## 指示内容

Zaim MCP機能拡張のフェーズ2として、`zaim_advanced_search`ツールを実装する。

## 目的

複合条件検索（AND/OR）、全フィールド検索、出力制御に対応した高度な検索ツールを実装する。

## 要件概要

### 1.1 複合条件検索
- AND条件: 複数の条件をすべて満たすレコードを抽出
- OR条件: いずれかの条件を満たすレコードを抽出
- 括弧によるグループ化: 条件の優先順位を明示的に指定可能

### 1.2 検索条件として指定可能な項目
- 日付（範囲指定）
- カテゴリID
- ジャンルID
- モード（payment/income/transfer）
- 金額（範囲指定、完全一致）
- 店舗名（place）
- 品目名（name）
- 口座ID（from_account_id / to_account_id）
- コメント（comment）

### 1.3 文字列フィールドの検索方式
- 完全一致: 値が完全に一致するもの
- 部分一致: 指定した文字列を含むもの

### 1.4 API制限を超えた件数取得
- MCP側で自動的にページネーション処理

### 1.5 検索結果の出力制御
- IDのみ / 指定フィールドのみ / 全フィールド
- 1件あたりの文字数制限
- 全体のレスポンス長制限

### 1.6 検索結果のソート順（固定）
1. 日付（新しい順）
2. 店舗名（place）順
3. 品目名（name）順

## 作業手順

### ステップ1: 要件ファイルと既存コードの確認
- [x] `.claude/zaim_mcp_extension_requirements.md` を確認
- [x] フェーズ1で作成された共通基盤ファイルを確認
  - `src/types/advanced-search.ts`
  - `src/utils/search-condition-evaluator.ts`
  - `src/utils/pagination-helper.ts`

### ステップ2: advanced-search-tool.tsの作成
- [x] `src/tools/advanced/advanced-search-tool.ts` を新規作成
- [x] 入力スキーマの定義
- [x] ツール定義（MCP形式）
- [x] 実装関数の作成

### ステップ3: 出力フォーマット関数の追加
- [x] `src/utils/search-condition-evaluator.ts`に`formatOutput`関数を追加

### ステップ4: インデックスファイルの作成
- [x] `src/tools/advanced/index.ts` を作成

### ステップ5: 動作確認
- [x] TypeScriptビルドの確認
- [x] 型エラーがないことを確認

## 進行状況

| ステップ | 状態 | 備考 |
|---------|------|------|
| ステップ1 | 完了 | 既存ファイルを確認し、構造を把握 |
| ステップ2 | 完了 | advanced-search-tool.ts作成 |
| ステップ3 | 完了 | formatOutput関数を追加 |
| ステップ4 | 完了 | index.ts作成 |
| ステップ5 | 完了 | ビルド成功、型エラーなし |

## 成果物

### 作成・修正したファイル一覧

1. **src/tools/advanced/advanced-search-tool.ts** (新規)
   - 高度検索ツールの実装

2. **src/tools/advanced/index.ts** (新規)
   - advancedディレクトリのエクスポート

3. **src/utils/search-condition-evaluator.ts** (修正)
   - formatOutput関数を追加
   - FormattedRecord型とFormatOutputResult型を追加
   - OutputControl, OutputFieldのインポートを追加

### ツールの入力パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| criteria | object | いいえ | 検索条件（単一または複合）。省略時は日付範囲内の全件を取得 |
| dateRange | object | はい | 検索対象の日付範囲 |
| dateRange.start | string | はい | 開始日（YYYY-MM-DD形式） |
| dateRange.end | string | はい | 終了日（YYYY-MM-DD形式） |
| output | object | いいえ | 出力制御設定 |
| output.mode | string | いいえ | 出力モード（id_only/specified/full） |
| output.fields | array | いいえ | 出力するフィールド配列（mode=specifiedの場合） |
| output.maxCharsPerRecord | number | いいえ | 1件あたりの最大文字数 |
| output.maxTotalChars | number | いいえ | 全体の最大文字数 |
| output.maxRecords | number | いいえ | 最大出力件数 |
| limit | number | いいえ | 最大取得件数 |

### 使用例

```json
// 例1: 2025年1月の食費で1000円以上の支出を検索
{
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "criteria": {
    "operator": "AND",
    "conditions": [
      { "field": "mode", "operator": "equals", "value": "payment" },
      { "field": "category", "operator": "contains", "value": "食費" },
      { "field": "amount", "operator": "greaterOrEqual", "value": 1000 }
    ]
  },
  "output": {
    "mode": "specified",
    "fields": ["id", "date", "amount", "place", "name"]
  }
}

// 例2: IDのみを取得
{
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "output": {
    "mode": "id_only"
  }
}

// 例3: コンビニまたはスーパーでの買い物を検索
{
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "criteria": {
    "operator": "OR",
    "conditions": [
      { "field": "place", "operator": "contains", "value": "コンビニ" },
      { "field": "place", "operator": "contains", "value": "スーパー" }
    ]
  }
}
```
