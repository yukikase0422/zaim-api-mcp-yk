# zaim_bulk_update

Zaim家計簿データの一括更新ツール。検索条件に合致するレコードを一括で更新します。

## 概要

指定した検索条件に合致するすべてのレコードを、指定した内容で一括更新します。安全のため、事前の件数確認が必須です。

## パラメータ

### 必須パラメータ

#### criteria

更新対象を特定する検索条件を指定します。**更新するフィールドは検索条件に含まれている必要があります**（整合性チェック）。

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
| conditions | array | 条件の配列 |

#### dateRange

検索対象の日付範囲を指定します。

| プロパティ | 型 | 説明 |
|-----------|------|------|
| start | string | 開始日（YYYY-MM-DD形式） |
| end | string | 終了日（YYYY-MM-DD形式） |

#### updates

更新内容を指定します。

**数値フィールド:**

| プロパティ | 型 | 説明 |
|-----------|------|------|
| category_id | number | 新しいカテゴリID |
| genre_id | number | 新しいジャンルID |
| amount | number | 新しい金額 |
| account_id | number | 新しい口座ID |
| from_account_id | number | 新しい振替元口座ID |
| to_account_id | number | 新しい振替先口座ID |

**日付フィールド:**

| プロパティ | 型 | 説明 |
|-----------|------|------|
| date | string | 新しい日付（YYYY-MM-DD形式） |

**文字列フィールド（place, name, comment）:**

文字列フィールドは2つのモードで更新できます。

**完全置換モード（mode: "replace"）:**

```json
{
  "place": {
    "mode": "replace",
    "newValue": "新しい店舗名"
  }
}
```

**部分置換モード（mode: "partial"）:**

```json
{
  "name": {
    "mode": "partial",
    "searchPattern": "旧品目",
    "replaceWith": "新品目"
  }
}
```

#### expectedCount

更新対象の期待件数。事前に`zaim_advanced_search`で確認した件数を指定します。実際の件数と一致しない場合はエラーになります。

### オプションパラメータ

#### dryRun

デフォルト: `false`

`true`の場合、実際の更新は行わず、対象レコードと更新内容のプレビューを返します。本番実行前の確認に使用してください。

## 使用例

### 例1: カテゴリを変更

「その他」カテゴリを「食費」カテゴリに変更します。

**事前確認（zaim_advanced_search）:**

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "category_id",
    "operator": "equals",
    "value": 101
  },
  "output": {
    "mode": "id_only"
  }
}
```

結果: 15件

**一括更新:**

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "category_id",
    "operator": "equals",
    "value": 101
  },
  "updates": {
    "category_id": 102
  },
  "expectedCount": 15
}
```

### 例2: 店舗名を部分置換

店舗名に含まれる「旧店舗」を「新店舗」に置換します。

**事前確認:**

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "place",
    "operator": "contains",
    "value": "旧店舗"
  }
}
```

結果: 8件

**一括更新:**

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "place",
    "operator": "contains",
    "value": "旧店舗"
  },
  "updates": {
    "place": {
      "mode": "partial",
      "searchPattern": "旧店舗",
      "replaceWith": "新店舗"
    }
  },
  "expectedCount": 8
}
```

### 例3: 複合条件での更新

特定の店舗かつ特定のカテゴリのレコードのジャンルを変更します。

**事前確認:**

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
        "field": "place",
        "operator": "contains",
        "value": "コンビニ"
      },
      {
        "field": "genre_id",
        "operator": "equals",
        "value": 201
      }
    ]
  }
}
```

結果: 5件

**一括更新:**

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
        "field": "place",
        "operator": "contains",
        "value": "コンビニ"
      },
      {
        "field": "genre_id",
        "operator": "equals",
        "value": 201
      }
    ]
  },
  "updates": {
    "genre_id": 202
  },
  "expectedCount": 5
}
```

### 例4: ドライランで確認

実際の更新を行う前にプレビューを確認します。

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "name",
    "operator": "equals",
    "value": "不明"
  },
  "updates": {
    "name": {
      "mode": "replace",
      "newValue": "雑費"
    }
  },
  "expectedCount": 3,
  "dryRun": true
}
```

## 注意点・制約

### 整合性チェック（重要）

**更新するフィールドは検索条件に含まれている必要があります。**

これは意図しない更新を防ぐための安全策です。例えば、`category_id`を更新する場合は、検索条件にも`category_id`の条件を含める必要があります。

```json
// NG: 更新フィールドが検索条件に含まれていない
{
  "criteria": {
    "field": "place",
    "operator": "contains",
    "value": "コンビニ"
  },
  "updates": {
    "category_id": 102  // エラー: category_idが検索条件にない
  }
}

// OK: 更新フィールドが検索条件に含まれている
{
  "criteria": {
    "operator": "AND",
    "conditions": [
      {
        "field": "place",
        "operator": "contains",
        "value": "コンビニ"
      },
      {
        "field": "category_id",
        "operator": "equals",
        "value": 101
      }
    ]
  },
  "updates": {
    "category_id": 102
  }
}
```

### 件数確認の必須化

`expectedCount`は必須パラメータです。事前に`zaim_advanced_search`で対象件数を確認し、その件数を指定してください。実際の対象件数と一致しない場合は更新が実行されません。

### レート制限

Zaim APIにはレート制限があります。大量のレコードを更新する場合、処理に時間がかかる場合があります（1件あたり約200msの間隔をあけて実行されます）。

### ドライラン推奨

本番実行前に`dryRun: true`でプレビューを確認することを強く推奨します。

## 関連ツール

- **zaim_advanced_search**: 更新対象を事前に確認するために使用。件数と内容を確認してからこのツールを実行してください。
- **zaim_update_money_record**: 1件のレコードを更新する場合はこちらを使用。
- **zaim_get_user_categories**: カテゴリIDを確認するために使用。
- **zaim_get_user_genres**: ジャンルIDを確認するために使用。

## 推奨ワークフロー

```
1. zaim_advanced_search で対象を検索・確認
   ↓
2. 件数と内容を確認
   ↓
3. zaim_bulk_update（dryRun: true）でプレビュー確認
   ↓
4. 問題なければ zaim_bulk_update（dryRun: false）で本番実行
```
