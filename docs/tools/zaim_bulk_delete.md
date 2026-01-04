# zaim_bulk_delete

Zaim家計簿データの一括削除ツール。検索条件に合致するレコードを一括で削除します。

## 概要

指定した検索条件に合致するすべてのレコードを一括削除します。**削除は永続的で復元できません。** 安全のため、検索条件と事前の件数確認が必須です。

## パラメータ

### 必須パラメータ

#### criteria

削除対象を特定する検索条件を指定します。**空の条件（条件なしでの全削除）は許可されていません。**

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

#### expectedCount

削除対象の期待件数。事前に`zaim_advanced_search`で確認した件数を指定します。実際の件数と一致しない場合はエラーになります。

### オプションパラメータ

#### dryRun

デフォルト: `false`

`true`の場合、実際の削除は行わず、対象レコードのプレビューを返します。本番実行前の確認に使用してください。

## 使用例

### 例1: 特定の店舗のレコードを削除

「テスト店舗」のレコードをすべて削除します。

**事前確認（zaim_advanced_search）:**

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "place",
    "operator": "equals",
    "value": "テスト店舗"
  }
}
```

結果: 5件

**一括削除:**

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "place",
    "operator": "equals",
    "value": "テスト店舗"
  },
  "expectedCount": 5
}
```

### 例2: 特定の金額以下のレコードを削除

100円以下の小額レコードを削除します。

**事前確認:**

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "amount",
    "operator": "lessOrEqual",
    "value": 100
  }
}
```

結果: 20件

**一括削除:**

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "amount",
    "operator": "lessOrEqual",
    "value": 100
  },
  "expectedCount": 20
}
```

### 例3: 複合条件での削除

特定の日付かつ特定の品目名のレコードを削除します。

**事前確認:**

```json
{
  "dateRange": {
    "start": "2024-01-15",
    "end": "2024-01-15"
  },
  "criteria": {
    "operator": "AND",
    "conditions": [
      {
        "field": "date",
        "operator": "equals",
        "value": "2024-01-15"
      },
      {
        "field": "name",
        "operator": "contains",
        "value": "重複"
      }
    ]
  }
}
```

結果: 3件

**一括削除:**

```json
{
  "dateRange": {
    "start": "2024-01-15",
    "end": "2024-01-15"
  },
  "criteria": {
    "operator": "AND",
    "conditions": [
      {
        "field": "date",
        "operator": "equals",
        "value": "2024-01-15"
      },
      {
        "field": "name",
        "operator": "contains",
        "value": "重複"
      }
    ]
  },
  "expectedCount": 3
}
```

### 例4: ドライランで確認

実際の削除を行う前にプレビューを確認します。

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "comment",
    "operator": "contains",
    "value": "削除予定"
  },
  "expectedCount": 10,
  "dryRun": true
}
```

## 注意点・制約

### 削除は復元不可（重要）

**削除されたレコードは復元できません。** 必ず事前に対象を確認し、ドライランで内容を確認してから実行してください。

### 空条件の禁止

検索条件なしでの全削除は許可されていません。必ず削除対象を特定する条件を指定してください。

```json
// NG: 条件なし（エラーになります）
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {},
  "expectedCount": 1000
}

// OK: 条件あり
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "criteria": {
    "field": "place",
    "operator": "equals",
    "value": "削除対象店舗"
  },
  "expectedCount": 10
}
```

### 件数確認の必須化

`expectedCount`は必須パラメータです。事前に`zaim_advanced_search`で対象件数を確認し、その件数を指定してください。実際の対象件数と一致しない場合は削除が実行されません。

これは誤って大量のレコードを削除することを防ぐための安全策です。

### レート制限

Zaim APIにはレート制限があります。大量のレコードを削除する場合、処理に時間がかかる場合があります（1件あたり約200msの間隔をあけて実行されます）。

### ドライラン必須推奨

本番実行前に`dryRun: true`でプレビューを確認することを**強く推奨**します。削除は取り消せないため、必ず確認してから実行してください。

## 関連ツール

- **zaim_advanced_search**: 削除対象を事前に確認するために使用。件数と内容を確認してからこのツールを実行してください。
- **zaim_delete_money_record**: 1件のレコードを削除する場合はこちらを使用。

## 推奨ワークフロー

```
1. zaim_advanced_search で対象を検索・確認
   ↓
2. 件数と内容を確認（削除して問題ないか）
   ↓
3. zaim_bulk_delete（dryRun: true）でプレビュー確認
   ↓
4. 削除対象が正しいことを最終確認
   ↓
5. zaim_bulk_delete（dryRun: false）で本番実行
```

## 安全チェックリスト

削除を実行する前に以下を確認してください：

- [ ] 対象レコードの件数は正しいですか？
- [ ] 対象レコードの内容は確認しましたか？
- [ ] ドライランで削除対象を確認しましたか？
- [ ] 削除して問題ないレコードですか？
- [ ] バックアップは必要ありませんか？
