# zaim_advanced_search

Zaim家計簿データの高度な検索ツール。複合条件（AND/OR）、全フィールド検索、出力制御に対応。

## 概要

指定した日付範囲内のデータを自動的にページネーションで取得し、複合条件でフィルタリングして返します。一括更新・一括削除の前に対象レコードを確認するために使用します。

## パラメータ

### 必須パラメータ

#### dateRange

検索対象の日付範囲を指定します。

| プロパティ | 型 | 説明 |
|-----------|------|------|
| start | string | 開始日（YYYY-MM-DD形式） |
| end | string | 終了日（YYYY-MM-DD形式） |

### オプションパラメータ

#### criteria

検索条件を指定します。省略時は日付範囲内の全件を取得します。

**単一条件の場合:**

| プロパティ | 型 | 説明 |
|-----------|------|------|
| field | string | 検索対象フィールド |
| operator | string | 比較演算子 |
| value | string/number | 検索値 |

**複合条件（AND/OR）の場合:**

| プロパティ | 型 | 説明 |
|-----------|------|------|
| operator | "AND" / "OR" | 複合演算子 |
| conditions | array | 条件の配列（単一条件または複合条件を含む） |

**検索対象フィールド一覧:**

- 文字列: `place`, `name`, `comment`, `category`, `genre`, `account`
- 数値: `id`, `category_id`, `genre_id`, `account_id`, `from_account_id`, `to_account_id`, `amount`
- 日付: `date`
- その他: `mode` (payment/income/transfer)

**比較演算子:**

| フィールド種別 | 演算子 |
|--------------|--------|
| 文字列 | `equals`, `contains`, `startsWith`, `endsWith` |
| 数値 | `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterOrEqual`, `lessOrEqual`, `between` |
| 日付 | `equals`, `before`, `after`, `onOrBefore`, `onOrAfter`, `between` |

#### output

出力制御設定を指定します。

| プロパティ | 型 | 説明 |
|-----------|------|------|
| mode | string | 出力モード: `id_only`（IDのみ）, `specified`（指定フィールド）, `full`（全フィールド） |
| fields | array | mode=specifiedの場合に出力するフィールド配列 |
| maxCharsPerRecord | number | 1件あたりの最大文字数 |
| maxTotalChars | number | 全体の最大文字数 |
| maxRecords | number | 最大出力件数 |

#### limit

最大取得件数。省略時は条件に合致する全件を取得します。

## 使用例

### 例1: 基本的な日付範囲検索

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  }
}
```

2024年1月の全レコードを取得します。

### 例2: 単一条件検索

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "place",
    "operator": "contains",
    "value": "コンビニ"
  }
}
```

店舗名に「コンビニ」を含むレコードを検索します。

### 例3: 複合条件検索（AND）

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "operator": "AND",
    "conditions": [
      {
        "field": "category",
        "operator": "equals",
        "value": "食費"
      },
      {
        "field": "amount",
        "operator": "greaterThan",
        "value": 1000
      }
    ]
  }
}
```

カテゴリが「食費」かつ金額が1000円を超えるレコードを検索します。

### 例4: 複合条件検索（OR）

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "operator": "OR",
    "conditions": [
      {
        "field": "place",
        "operator": "contains",
        "value": "Amazon"
      },
      {
        "field": "place",
        "operator": "contains",
        "value": "楽天"
      }
    ]
  }
}
```

店舗名に「Amazon」または「楽天」を含むレコードを検索します。

### 例5: IDのみ取得（一括操作の前段階）

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "name",
    "operator": "equals",
    "value": "不明な支出"
  },
  "output": {
    "mode": "id_only"
  }
}
```

品目名が「不明な支出」のレコードのIDのみを取得します。一括更新や一括削除の前に対象を確認する際に便利です。

### 例6: 金額範囲検索（between）

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "amount",
    "operator": "between",
    "value": [1000, 5000]
  }
}
```

金額が1000円以上5000円以下のレコードを検索します。

## 注意点・制約

### 日付範囲は必須

日付範囲（dateRange）は必須パラメータです。これはAPIのページネーション処理に必要なためです。広い日付範囲を指定すると、取得に時間がかかる場合があります。

### 出力サイズの制限

大量のレコードを取得する場合は、`output`パラメータで出力を制御することをお勧めします。特に一括操作の前段階では`mode: "id_only"`を使用することで、コンテキストの消費を抑えられます。

### 検索条件のネスト

複合条件は深くネストできますが、あまりに複雑な条件は可読性が低下します。適切な粒度で条件を構成してください。

## 関連ツール

- **zaim_bulk_update**: 検索結果のレコードを一括更新する場合に使用。事前にこのツールで件数を確認してください。
- **zaim_bulk_delete**: 検索結果のレコードを一括削除する場合に使用。事前にこのツールで件数を確認してください。
- **zaim_get_money_records**: シンプルな条件での検索。日付、カテゴリ、ジャンル、口座、種別のみで絞り込む場合に適しています。

## 推奨ワークフロー

### 一括更新・一括削除の前に

1. `zaim_advanced_search`で対象レコードを検索
2. 件数と内容を確認
3. 問題なければ`zaim_bulk_update`または`zaim_bulk_delete`を実行

```
手順1: zaim_advanced_search（対象確認） -> 10件
手順2: zaim_bulk_update（expectedCount: 10） -> 実行
```
