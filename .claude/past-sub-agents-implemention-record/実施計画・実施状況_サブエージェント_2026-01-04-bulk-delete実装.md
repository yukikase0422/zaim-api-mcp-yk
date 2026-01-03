# 実施計画・実施状況: zaim_bulk_delete ツール実装

## 作業開始時刻
2026-01-04

## 指示内容
Zaim MCP機能拡張のフェーズ4として、`zaim_bulk_delete`ツールを実装する。

### 要件
- 検索条件に合致するレコードを一括削除
- 安全策として件数指定必須
- 検索条件の指定が必須（条件なしでの全削除は不可）

### 作業内容
1. `src/tools/advanced/bulk-delete-tool.ts` を新規作成
2. `src/tools/advanced/index.ts` を更新
3. `src/tools/registry.ts` にツール定義を追加
4. `src/core/tool-handler.ts` に実行ケースを追加
5. ビルド確認

## 進行状況

### 1. 実施計画ファイル作成
- [x] 完了

### 2. 既存実装の確認
- [x] bulk-update-tool.ts の確認
- [x] money-delete-tools.ts の delete 実装確認
- [x] advanced-search.ts の型定義確認

### 3. bulk-delete-tool.ts 作成
- [x] 入力スキーマ定義
- [x] ツール定義作成
- [x] 実装関数作成
- [x] 安全策の実装

### 4. index.ts 更新
- [x] エクスポート追加

### 5. registry.ts 更新
- [x] ツール定義追加

### 6. tool-handler.ts 更新
- [x] 実行ケース追加

### 7. ビルド確認
- [x] npm run build 実行
- [x] エラーなしで完了

## 成果物

### 作成・更新ファイル一覧

| ファイルパス | 変更内容 |
|-------------|---------|
| `src/tools/advanced/bulk-delete-tool.ts` | 新規作成 - 一括削除ツールの実装 |
| `src/tools/advanced/index.ts` | エクスポート追加 |
| `src/tools/registry.ts` | bulkDeleteToolDefinitionのインポートと登録 |
| `src/core/tool-handler.ts` | zaim_bulk_deleteケースの追加 |

### 入力パラメータ一覧

| パラメータ名 | 型 | 必須 | 説明 |
|-------------|-----|-----|------|
| criteria | SearchCriteria | はい | 検索条件（削除対象を特定） |
| dateRange | object | はい | 日付範囲（start, end: YYYY-MM-DD形式） |
| expectedCount | number | はい | 期待する削除対象件数（安全策） |
| dryRun | boolean | いいえ | trueでプレビューのみ（デフォルト: false） |

### 安全策の実装詳細

1. **検索条件必須**
   - `criteria`パラメータが必須
   - `isEmptyCriteria()`関数で空条件をチェック
   - 空条件の場合はエラーメッセージを返す

2. **件数確認必須**
   - `expectedCount`パラメータが必須
   - 実際の対象件数と一致しない場合はエラー
   - メッセージで期待件数と実際件数を表示

3. **ドライランオプション**
   - `dryRun: true`で実際の削除を行わずにプレビュー可能
   - 削除対象レコードの概要を返す

### ビルド結果
- `npm run build`: 成功（エラーなし）
