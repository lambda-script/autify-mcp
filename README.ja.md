# @lambda-script/autify-mcp

Autify for Web の公開 API を AI エージェントに公開する MCP サーバーです。

## 概要

`@lambda-script/autify-mcp` は、Claude Code や Claude Desktop などの MCP クライアントが [Autify for Web](https://autify.com/) API に直接アクセスできるようにする [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) サーバーです。AI エージェントは、標準の MCP ツール・リソースインターフェースを通じて、テストシナリオや実行結果の参照、テストプランの実行、テスト設定の管理を行うことができます。

## インストール & 実行

インストールは不要です。次のコマンドでサーバーをオンデマンド実行できます。

```sh
npx @lambda-script/autify-mcp
```

**要件:** Node.js >=20.3.0

## 設定

`.mcp.json`（Claude Desktop の場合は `claude_desktop_config.json`）にサーバーを追加してください。

```json
{
  "mcpServers": {
    "autify": {
      "command": "npx",
      "args": ["@lambda-script/autify-mcp"],
      "env": { "AUTIFY_API_TOKEN": "your-token", "AUTIFY_PROJECT_ID": "123" }
    }
  }
}
```

### 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `AUTIFY_API_TOKEN` | **必須** | Autify API の Bearer トークンです。未設定の場合、サーバーは即座に終了します。 |
| `AUTIFY_PROJECT_ID` | 任意 | ツールの `project_id` 引数が省略された際に使用されるデフォルトのプロジェクト ID です。 |
| `AUTIFY_BASE_URL` | 任意 | API のベース URL を上書きします。デフォルトは `https://app.autify.com/api/v1/` です。 |
| `AUTIFY_READONLY` | 任意 | `"true"` に設定すると読み取り専用モードが有効になります（後述）。 |
| `AUTIFY_LOG_FILE` | 任意 | ログファイルのパスです。未設定の場合、ログは stderr に出力されます。 |

## ツール

### 読み取り（10 ツール）

これらのツールは安全で冪等であり、テストクレジットを消費しません。

| ツール | 説明 |
|---|---|
| `autify_list_scenarios` | プロジェクト内のテストシナリオを一覧表示します。 |
| `autify_describe_scenario` | 単一のシナリオの詳細を取得します。 |
| `autify_list_results` | プロジェクト内のテスト実行結果を一覧表示します。 |
| `autify_describe_result` | 単一の実行結果の詳細を取得します。 |
| `autify_list_capabilities` | 利用可能なブラウザ・OS のケイパビリティの組み合わせを一覧表示します。 |
| `autify_list_access_points` | プロジェクトに設定されたアクセスポイントを一覧表示します。 |
| `autify_list_url_replacements` | テストプランの URL 置換ルールを一覧表示します。 |
| `autify_list_test_plan_variables` | テストプランに定義された変数を一覧表示します。 |
| `autify_get_credit_usage` | プロジェクトのクレジット使用状況のサマリーを取得します。 |
| `autify_get_project_info` | プロジェクトのメタデータを取得します。 |

### 実行 — 課金対象（2 ツール）

これらのツールはテストの実行をトリガーし、**Autify のテストクレジットを消費します**。読み取り専用モードでは無効になります。

| ツール | 説明 |
|---|---|
| `autify_execute_scenarios` | 1 つ以上のテストシナリオをただちに実行します。 |
| `autify_execute_schedule` | スケジュール済みのテストプラン実行をトリガーします。 |

### 設定変更（10 ツール）

これらのツールはテスト設定を作成・更新・削除します。削除操作は**破壊的**かつ不可逆です。すべて読み取り専用モードでは無効になります。

| ツール | 説明 |
|---|---|
| `autify_update_scenario` | シナリオのメタデータを更新します。 |
| `autify_duplicate_scenario` | 既存のシナリオを複製します。 |
| `autify_create_access_point` | 新しいアクセスポイントを作成します。 |
| `autify_delete_access_point` | **破壊的。** アクセスポイントを完全に削除します。 |
| `autify_create_url_replacement` | URL 置換ルールを作成します。 |
| `autify_update_url_replacement` | URL 置換ルールを更新します。 |
| `autify_delete_url_replacement` | **破壊的。** URL 置換ルールを完全に削除します。 |
| `autify_create_test_plan_variable` | テストプランに変数を作成します。 |
| `autify_update_test_plan_variable` | テストプランの変数を更新します。 |
| `autify_delete_test_plan_variable` | **破壊的。** テストプランの変数を完全に削除します。 |

### 便利ツール（1 ツール）

| ツール | 説明 |
|---|---|
| `autify_wait_for_result` | 指定した結果 ID が終端状態（`passed`、`failed`、`skipped`、`internal_error`、`canceled`）になるまでポーリングします。省略可能な引数として `project_id`、`timeoutSec`（最大 1800）、`pollIntervalSec` を受け付けます。 |

## リソース

サーバーは 2 つの読み取り専用 MCP リソースを公開しています。いずれも `AUTIFY_PROJECT_ID` で設定されたプロジェクトを使用します。

| URI | 説明 |
|---|---|
| `autify://project_info` | 現在のプロジェクトのメタデータ。 |
| `autify://capabilities` | 利用可能なブラウザ・OS のケイパビリティの組み合わせ。 |

## 読み取り専用モード

`AUTIFY_READONLY=true` を設定すると、サーバーは読み取り専用モードで起動します。このモードでは、10 の読み取りツールと `autify_wait_for_result` のみが登録されます。2 つの実行ツールと 10 の設定変更ツールは利用できません。

テストデータの参照は許可しつつ、テスト実行の誤トリガーや設定変更のリスクをゼロにしたいデプロイ環境でのご利用をお勧めします。

## 開発

リポジトリをクローンして依存関係をインストールします。

```sh
git clone https://github.com/lambda-script/autify-mcp.git
cd autify-mcp
npm install
```

| スクリプト | 用途 |
|---|---|
| `npm run generate` | `openapi-typescript` を使って `openapi/swagger.yml` から TypeScript の型を再生成します。 |
| `npm run build` | サーバーをコンパイルして `dist/` にバンドルします。 |
| `npm test` | Vitest でテストスイートを一度実行します。 |
| `npm run test:coverage` | テストを実行してカバレッジレポートを生成します。 |
| `npm run lint` | ESLint で `src/` を静的解析します。 |
| `npm run typecheck` | ファイルを出力せずに TypeScript の型検査を実行します。 |

### OpenAPI スペックの更新手順

1. `openapi/swagger.yml` を新しいスペックファイルで置き換えます。
2. `npm run generate` を実行して `src/generated/autify.d.ts` を再生成します。
3. 差分を確認します — 新しいパス、リクエスト・レスポンスの変更、削除されたオペレーションに注意してください。
4. `src/tools/` 配下のツール実装に対して、破壊的変更を調整・反映します。

## ライセンス

MIT — [LICENSE](./LICENSE) を参照してください。
