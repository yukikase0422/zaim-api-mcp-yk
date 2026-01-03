# Zaim API MCPサーバー エラー調査報告

## 実施日時
2026-01-03

## 問題の概要
Claude DesktopでMCPサーバー `zaim-api` が「failed」状態になり、「Server disconnected」エラーが発生している。

---

## 調査結果

### 1. Claude Desktopログファイルの分析

**ログファイルパス**: `C:\Users\yukik\AppData\Roaming\Claude\logs\mcp-server-zaim-api.log`

**重要なエラーメッセージ**:
```
2026-01-03T11:39:20.074Z [zaim-api] [info] Server started and connected successfully
2026-01-03T11:39:20.264Z [zaim-api] [info] Server transport closed
2026-01-03T11:39:20.265Z [zaim-api] [info] Server transport closed unexpectedly,
this is likely due to the process exiting early.
2026-01-03T11:39:20.265Z [zaim-api] [error] Server disconnected.
```

**分析結果**:
- サーバーは正常に起動している（"Server started and connected successfully"）
- しかし、起動直後（約190ms後）にプロセスが終了している
- エラー内容: プロセスが早期終了（"process exiting early"）

### 2. ビルド成果物の確認

**確認内容**:
- `dist/index.js` は存在する（2166バイト）
- ビルドは正常に完了している
- その他の関連ファイルも正常に生成されている

### 3. MCPサーバー直接起動テスト

**実行コマンド**:
```cmd
cd "d:\UserFolders\yukik\Desktop\_自作アプリ\4_Web・SNS連携\ZaimMCP"
set ZAIM_CONSUMER_KEY=***
set ZAIM_CONSUMER_SECRET=***
set ZAIM_ACCESS_TOKEN=***
set ZAIM_ACCESS_TOKEN_SECRET=***
node dist/index.js
```

**結果**: 何も出力されずにプロセスが終了

### 4. デバッグ調査

デバッグスクリプトを作成して、エントリーポイント条件式の実際の値を確認：

```
import.meta.url: file:///D:/UserFolders/yukik/Desktop/_%E8%87%AA%E4%BD%9C%E3%82%A2%E3%83%97%E3%83%AA/4_Web%E3%83%BBSNS%E9%80%A3%E6%90%BA/ZaimMCP/debug-entry.js
process.argv[1]: D:\UserFolders\yukik\Desktop\_自作アプリ\4_Web・SNS連携\ZaimMCP\debug-entry.js
Expected format: file://D:\UserFolders\yukik\Desktop\_自作アプリ\4_Web・SNS連携\ZaimMCP\debug-entry.js
Condition result: false
```

---

## エラーの根本原因

**問題箇所**: `src/index.ts` の77行目

```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

**原因の詳細**:

この条件式が常に `false` になるため、`main()` 関数が実行されず、サーバーが起動しない。

### 条件式が false になる理由

1. **スラッシュの数の違い**:
   - `import.meta.url`: `file:///D:/...` （スラッシュ3つ）
   - テンプレート文字列の結果: `file://D:\...` （スラッシュ2つ）

2. **URLエンコーディングの違い**:
   - `import.meta.url`: 日本語がURLエンコードされる（例: `_%E8%87%AA%E4%BD%9C%E3%82%A2%E3%83%97%E3%83%AA`）
   - `process.argv[1]`: 生の日本語文字（例: `_自作アプリ`）

3. **パス区切り文字の違い**:
   - `import.meta.url`: `/` （フォワードスラッシュ）
   - `process.argv[1]`: `\` （バックスラッシュ、Windows環境）

---

## 推奨される修正方法

### 方法1: 条件式を削除（最も簡単・推奨）

MCPサーバーは常に直接実行されるため、条件チェックは不要です。

**修正内容** (`src/index.ts` の77-82行目):

```typescript
// 修正前
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// 修正後
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**メリット**:
- 最も簡単で確実
- 追加のimportが不要
- MCPサーバーの使用ケースに適している

### 方法2: fileURLToPathを使用（より正確）

パスを正規化して比較する方法です。

**修正内容**:

```typescript
import { fileURLToPath } from 'url';

// ... (他のコードは同じ) ...

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

**メリット**:
- より正確なパス比較
- 他のモジュールからimportされた場合の動作を制御可能

**デメリット**:
- 追加のimportが必要
- MCPサーバーの場合、この精度は不要

### 方法3: pathToFileURLを使用

URLを正規化して比較する方法です。

**修正内容**:

```typescript
import { pathToFileURL } from 'url';

// ... (他のコードは同じ) ...

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

**メリット**:
- URLベースでの正確な比較

**デメリット**:
- 追加のimportが必要
- 方法2よりも複雑

---

## 修正手順

### 推奨手順（方法1）

1. `src/index.ts` を開く
2. 77-82行目の条件式を以下のように修正:
   ```typescript
   main().catch((error) => {
     console.error('Fatal error:', error);
     process.exit(1);
   });
   ```
3. ビルド: `npm run build`
4. 動作確認: Claude Desktopを再起動してMCPサーバーの状態を確認

---

## まとめ

- **エラー原因**: `src/index.ts` の77行目の条件式が常に `false` になり、`main()` が実行されない
- **推奨修正**: 条件式を削除して、常に `main()` を実行するように変更
- **修正後の動作**: MCPサーバーが正常に起動し、Claude Desktopから利用可能になる

---

## 補足情報

### デバッグファイルのクリーンアップ

調査で作成した `debug-entry.js` は、修正完了後に削除してください：

```bash
rm debug-entry.js
```
