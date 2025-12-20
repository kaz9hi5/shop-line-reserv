## Supabase（バックエンド）構成

このリポジトリでは Supabase をバックエンドとして利用します。

### ディレクトリ構成

```
supabase/
├── migrations/          # DB スキーマ（SQL マイグレーション）
│   ├── 0001_init.sql    # 初期スキーマ（テーブル定義、トリガー、制約）
│   ├── 0002_rls_minimum.sql  # Row Level Security の最小設定
│   ├── 0003_visit_reset_counts.sql  # 来店確認（回数リセット）
│   └── 0004_line_migration.sql  # LINE対応へのマイグレーション
├── functions/           # Edge Functions（サーバーレス関数）
│   ├── _shared/        # 共通モジュール
│   │   ├── cors.ts     # CORS ヘッダー設定
│   │   └── line.ts     # LINE Messaging API 送信クライアント
│   └── send-line-message/  # LINE メッセージ送信 Edge Function
│       └── index.ts    # メイン処理（POST リクエスト受信、LINE メッセージ送信）
├── config.toml          # Supabase CLI 設定ファイル（ローカル開発用）
└── README.md           # このファイル
```

### データベーススキーマ（migrations/）

#### `0001_init.sql` - 初期スキーマ

**テーブル一覧：**

1. **`app_settings`** - アプリケーション全体の設定（シングルトン）

   - 予約キャンセル・変更期限（時間単位）
   - デフォルト営業時間（開始/終了、昼休憩）
   - アクセスログ記録の有効/無効

2. **`admin_allowed_ips`** - 管理画面アクセス許可 IP アドレス（ホワイトリスト）

   - IP アドレス（主キー）
   - 論理削除対応（`deleted_at`）

3. **`admin_access_logs`** - 管理画面アクセスログ

   - 日時、IP アドレス、アクセス結果（許可/拒否）、パス、ユーザーエージェント

4. **`treatments`** - 施術メニュー

   - 名前、概要、施術時間（分）、価格（円）
   - 論理削除対応

5. **`business_days`** - 営業日設定（日毎）

   - 日付（主キー）、状態（営業日/休日/定休日）

6. **`business_hours_overrides`** - 日毎の営業時間上書き設定

   - 日付（主キー）、開始/終了時間、昼休憩設定

7. **`reservations`** - 予約情報
   - 顧客情報（名前、LINE ユーザー ID、LINE 表示名）
   - 施術情報（スナップショット保存）
   - 予約日時（`start_at`, `end_at`）
   - 予約経路（web/phone/admin）
   - 論理削除対応
   - 重複予約防止制約（`reservations_no_overlap_active`）

**主な機能：**

- **自動更新タイムスタンプ**: `set_updated_at()` 関数とトリガー
- **予約終了時刻の自動計算**: `reservations_apply_treatment_snapshot()` 関数
  - 施術時間から `end_at` を自動計算
  - 施術情報をスナップショットとして保存
- **重複予約防止**: `exclude` 制約でアクティブな予約の時間重複を防止

#### `0003_visit_reset_counts.sql` - 来店確認（回数リセット）

- LINE ユーザー ID 単位の回数管理テーブル **`customer_action_counters`** を追加
- `reservations` に **`arrived_at`** を追加（来店済み記録）
- DB 関数 **`mark_arrived_and_reset_counts(reservation_id)`** を追加（来店確認 + 回数リセットを一括実行）

#### `0004_line_migration.sql` - LINE対応へのマイグレーション

- `reservations` テーブル: `phone_e164` → `line_user_id`, `phone_last4` → `line_display_name` に変更
- `customer_action_counters` テーブル: `phone_e164` → `line_user_id` に変更
- `mark_arrived_and_reset_counts` 関数を LINE ユーザー ID 対応に更新

#### `0002_rls_minimum.sql` - Row Level Security の最小設定

- 管理系テーブル（`app_settings`, `admin_allowed_ips`, `admin_access_logs`）に RLS を有効化
- デフォルトはアクセス拒否（ポリシー未設定のため）
- 顧客向けテーブル（`treatments`, `business_days`, `reservations` など）は必要に応じて後から RLS を有効化可能

### Edge Functions（functions/）

#### `send-line-message` - LINE メッセージ送信 Edge Function

**機能：**

- LINE Messaging API を使用して LINE メッセージを送信する Edge Function
- POST リクエストで `reservation_id` または `to`（LINE ユーザー ID）と `messages` を受け取る
- 予約IDが指定された場合、予約情報を取得してメッセージを自動構築
- CORS 対応（OPTIONS リクエスト対応）

**リクエスト形式（予約ID指定）：**

```json
{
  "reservation_id": "uuid-string"
}
```

**リクエスト形式（直接送信）：**

```json
{
  "to": "U1234567890abcdef1234567890abcdef",
  "messages": [
    {
      "type": "text",
      "text": "予約が確定しました..."
    }
  ]
}
```

**レスポンス形式：**

```json
{
  "ok": true,
  "result": { ... }
}
```

**必要な環境変数（Supabase 管理画面で設定）：**

- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Channel Access Token
- `SUPABASE_URL` - Supabase プロジェクトの URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key（予約情報取得用）
- `WEB_APP_URL` - Web アプリの URL（予約変更・キャンセル URL 生成用）

#### `_shared/cors.ts` - CORS ヘッダー設定

- Edge Functions 用の CORS ヘッダーを定義
- `access-control-allow-origin`, `access-control-allow-headers`, `access-control-allow-methods` を設定

#### `_shared/line.ts` - LINE Messaging API 送信クライアント

- LINE Messaging API を使用してメッセージを送信する共通関数
- 環境変数から認証情報を取得
- HTTP リクエストで LINE Messaging API を呼び出し
- プッシュメッセージの送信に対応

### セットアップ手順

#### 1. Supabase プロジェクト作成

1. [Supabase](https://supabase.com) でアカウント作成・ログイン
2. 「New Project」でプロジェクト作成
3. プロジェクト名、データベースパスワード、リージョンを設定

#### 2. マイグレーション適用

**方法 A: Supabase 管理画面（SQL Editor）**

- 左メニュー「SQL Editor」を開く
- `0001_init.sql` の内容をコピーして実行
- `0002_rls_minimum.sql` の内容をコピーして実行
- `0003_visit_reset_counts.sql` の内容をコピーして実行
- `0004_line_migration.sql` の内容をコピーして実行

**方法 B: Supabase CLI（推奨）**

```bash
# Supabase CLI インストール（未インストールの場合）
npm install -g supabase

# プロジェクトにリンク
supabase link --project-ref your-project-ref

# マイグレーション適用
supabase db push
```

#### 3. Edge Function のデプロイ

**方法 A: Supabase 管理画面**

- 左メニュー「Edge Functions」を開く
- 「Create a new function」をクリック
- Function 名: `send-line-message`
- ファイルをアップロード/作成

**方法 B: Supabase CLI（推奨）**

```bash
# Edge Function デプロイ
supabase functions deploy send-line-message

# 環境変数設定
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
supabase secrets set SUPABASE_URL=https://xxxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set WEB_APP_URL=https://your-app.vercel.app
```

#### 4. 環境変数の設定

Supabase 管理画面で設定：

- 「Project Settings」→「Edge Functions」→「Secrets」
- 以下を追加：
  - `LINE_CHANNEL_ACCESS_TOKEN` - LINE Channel Access Token（[LINE Developers](https://developers.line.biz/) で取得）
  - `SUPABASE_URL` - Supabase プロジェクトの URL
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key（Project Settings → API で取得）
  - `WEB_APP_URL` - Web アプリの URL（Vercel デプロイ後の URL）

**LINE Channel Access Token の取得方法：**
1. [LINE Developers](https://developers.line.biz/) にアクセス
2. プロバイダーを作成（未作成の場合）
3. チャネル（Messaging API）を作成
4. チャネル設定 → 「Messaging API」タブ → 「Channel access token」を発行

#### 5. Database Webhooks の設定（保存後 LINE メッセージ送信用）

- 「Database」→「Webhooks」→「Create a new webhook」
- テーブル: `reservations`
- イベント: `INSERT`（予約作成時のみ送信）
- HTTP Request: Edge Function の URL（`https://xxx.supabase.co/functions/v1/send-line-message`）
- HTTP Method: `POST`
- HTTP Headers: `Authorization: Bearer <SERVICE_ROLE_KEY>`（Secret 設定）
- Request Body: `{ "reservation_id": "{{ $1.id }}" }`

### ローカル開発（Supabase CLI）

```bash
# ローカル Supabase 起動
supabase start

# マイグレーション適用
supabase db reset

# Edge Function ローカル実行
supabase functions serve send-line-message

# ローカル Supabase 停止
supabase stop
```

### 参考リンク

- [Supabase 公式ドキュメント](https://supabase.com/docs)
- [Supabase Edge Functions ドキュメント](https://supabase.com/docs/guides/functions)
- [Supabase CLI ドキュメント](https://supabase.com/docs/guides/cli)
