# Vercel デプロイ手順チェックリスト

このドキュメントは、shopSmsReserv プロジェクトを Vercel にデプロイする手順をチェックリスト形式でまとめたものです。

---

## ステップ 1: Supabase プロジェクトのセットアップ

### 1.1 Supabase アカウント作成・ログイン

- [✅] [Supabase](https://supabase.com) にアクセス
- [✅] アカウント作成（GitHub アカウントでログイン可）
- [✅] ログイン完了

### 1.2 新規プロジェクト作成

- [✅] 「New Project」をクリック
- [✅] プロジェクト名を設定
- [ ] データベースパスワードを設定
- [✅] リージョンを選択（推奨: Northeast Asia (Tokyo)）
- [✅] 「Create new project」をクリック
- [✅] プロジェクト作成完了を待つ（数分）

### 1.3 マイグレーション適用

- [✅] プロジェクト作成後、左メニュー「SQL Editor」を開く
- [ ] `supabase/migrations/0001_init.sql` の内容をコピーして実行
- [ ] `supabase/migrations/0002_rls_minimum.sql` の内容をコピーして実行
- [ ] `supabase/migrations/0003_visit_reset_counts.sql` の内容をコピーして実行
- [ ] `supabase/migrations/0004_line_migration.sql` の内容をコピーして実行
- [✅] すべてのマイグレーションが正常に適用されたことを確認

### 1.4 Edge Function のデプロイ

- [✅] 左メニュー「Edge Functions」を開く
- [✅] 「Create a new function」をクリック
- [✅] Function 名: `send-line-message` を入力
- [✅] 以下のファイルをアップロード/作成:
  - [ ] `supabase/functions/send-line-message/index.ts`
  - [ ] `supabase/functions/_shared/cors.ts`
  - [ ] `supabase/functions/_shared/line.ts`
- [✅] Edge Function のデプロイが完了したことを確認

**注意**: Supabase CLI を使用する場合:

```bash
cd supabase
supabase functions deploy send-line-message
```

### 1.5 環境変数の設定（Supabase）

- [✅] 「Project Settings」→「Edge Functions」→「Secrets」を開く
- [✅] 以下を追加:
  - [✅] `LINE_CHANNEL_ACCESS_TOKEN` = `your_line_channel_access_token`
  - [✅] `SUPABASE_URL` = `https://xxxxx.supabase.co`（プロジェクトの URL）
  - [✅] `SUPABASE_SERVICE_ROLE_KEY` = `your_service_role_key`（Service Role Key）
  - [] `WEB_APP_URL` = `https://your-app.vercel.app`（Vercel デプロイ後の URL）
- [ ] すべての環境変数が設定されたことを確認

**LINE Channel Access Token の取得方法:**

1. [LINE Developers](https://developers.line.biz/) にアクセス
2. プロバイダーを作成（未作成の場合）
3. チャネル（Messaging API）を作成
4. チャネル設定 → 「Messaging API」タブ → 「Channel access token」を発行
   ✅

### 1.6 Supabase 接続情報の取得

- [✅] 「Project Settings」→「API」を開く
- [✅] 以下をメモ（後で使用）:
  - [✅] Project URL（`https://vysnppcgilkaiufihiig.supabase.co`）
  - [✅] `anon` `public` key（`NEXT_PUBLIC_SUPABASE_ANON_KEY` として使用）
    `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5c25wcGNnaWxrYWl1ZmloaWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTcxNzAsImV4cCI6MjA4MTgzMzE3MH0.sIKVXX1ER6to5PTaD_gT3fjWMnVB3UcVmlfinvEeOJE`

---

## ステップ 2: GitHub リポジトリの準備

### 2.1 GitHub リポジトリ作成

- [ ] プロジェクトルートで Git リポジトリを初期化（未初期化の場合）
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  ```

### 2.2 GitHub にプッシュ

- [ ] GitHub で新規リポジトリを作成
- [ ] リモートリポジトリを追加
  ```bash
  git remote add origin https://github.com/your-username/shopSmsReserv.git
  git branch -M main
  git push -u origin main
  ```
- [✅] GitHub にプッシュが完了したことを確認

---

## ステップ 3: Vercel アカウント作成・プロジェクト連携

### 3.1 Vercel アカウント作成

- [✅] [Vercel](https://vercel.com) にアクセス
- [✅] 「Sign Up」をクリック
- [✅] GitHub アカウントでログイン
- [✅] Vercel アカウント作成完了

### 3.2 プロジェクトのインポート

- [✅] Vercel ダッシュボードで「Add New...」→「Project」をクリック
- [✅] 「Import Git Repository」で先ほど作成した GitHub リポジトリを選択
- [✅] 「Import」をクリック

### 3.3 プロジェクト設定

- [✅] Framework Preset: **Next.js**（自動検出されていることを確認）
- [✅] Root Directory: **`web`** に変更
- [✅] Build Command: `npm run build`（デフォルト）
- [✅] Output Directory: `.next`（デフォルト）
- [✅] Install Command: `npm install`（デフォルト）

### 3.4 環境変数の設定

- [✅] 「Environment Variables」セクションを開く
- [✅] 以下を追加:
  - [✅] `NEXT_PUBLIC_SUPABASE_URL` = `https://xxxxx.supabase.co`（ステップ 1.6 で取得した値）
  - [✅] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your_anon_key_here`（ステップ 1.6 で取得した値）
- [ ] 各環境変数に適用する環境を選択（Production, Preview, Development すべてにチェック）
- [ ] 「Add」をクリックして保存
- [ ] **重要**: `NEXT_PUBLIC_` プレフィックスが付いていることを確認（フロントエンドで使用するため）

### 3.5 デプロイ実行

- [ ] 設定を確認
- [ ] 「Deploy」をクリック
- [ ] ビルド完了まで待機（数分）
- [ ] デプロイが成功したことを確認

---

## ステップ 4: デプロイ後の確認

### 4.1 デプロイ URL 確認

- [ ] Vercel ダッシュボードに表示される URL を確認
  - 例: `https://shop-sms-reserv.vercel.app`
- [ ] URL をメモ（後で使用）

### 4.2 動作確認

#### 顧客向け画面

- [ ] 顧客向け画面にアクセス: `https://your-domain.vercel.app/`
- [ ] 画面が正常に表示されることを確認

#### 管理画面

- [ ] 管理画面にアクセス: `https://your-domain.vercel.app/admin`
- [ ] 管理画面が正常に表示されることを確認
- [ ] 予約一覧が表示されることを確認（Supabase からデータが取得できているか）
- [ ] 予約作成・変更・キャンセルが動作することを確認
- [ ] 設定画面で営業時間・営業日が保存できることを確認
- [ ] 施術メニューの追加・編集・削除が動作することを確認
- [ ] アクセスログ画面でログが表示されることを確認

### 4.3 エラー確認

- [ ] Vercel ダッシュボードの「Deployments」タブでログを確認
- [ ] ブラウザのコンソール（F12）でエラーを確認
- [ ] エラーがないことを確認

---

## ステップ 5: Database Webhooks の設定（保存後 LINE メッセージ送信用）

### 5.1 Webhook 作成

- [✅] Supabase 管理画面で「Database」→「Webhooks」を開く
- [✅] 「Create a new webhook」をクリック

### 5.2 Webhook 設定

- [✅] テーブル: **`reservations`** を選択
- [✅] イベント: **`INSERT`** を選択（予約作成時のみ送信）
- [✅] HTTP Request URL: Edge Function の URL を入力
  - 例: `https://xxxxx.supabase.co/functions/v1/send-line-message`
- [✅] HTTP Method: **`POST`** を選択
- [✅] HTTP Headers: `Authorization: Bearer <SERVICE_ROLE_KEY>` を設定（Secret 設定）
- [✅] Request Body: 以下の JSON を設定:
  ```json
  {
    "reservation_id": "{{ $1.id }}"
  }
  ```
- [✅] 「Create」をクリック
- [✅] Webhook が作成されたことを確認

**注意**: 予約変更・キャンセル時の通知は、アプリケーション側から直接 Edge Function を呼び出す実装を推奨します。

---

## ステップ 6: カスタムドメイン設定（オプション）

### 6.1 ドメイン追加

- [ ] Vercel ダッシュボード → 「Settings」→「Domains」を開く
- [ ] ドメインを入力
- [ ] 「Add」をクリック

### 6.2 DNS 設定

- [ ] ドメイン提供元の DNS 設定を開く
- [ ] Vercel が指定するレコード（A レコードまたは CNAME）を追加
- [ ] DNS 設定の反映を待つ（数分〜数時間）
- [ ] カスタムドメインでアクセスできることを確認

---

## トラブルシューティング

### ビルドエラーが発生する場合

- [ ] Root Directory が `web` になっているか確認
- [ ] 環境変数が正しく設定されているか確認
  - [ ] `NEXT_PUBLIC_` プレフィックスが付いているか確認
- [ ] `web/package.json` に必要なパッケージが含まれているか確認
  - [ ] `@supabase/supabase-js` が含まれているか確認（既に追加済み）
  - [ ] 不足している場合はローカルで `npm install` を実行してからコミット・プッシュ

### Supabase 接続エラーが発生する場合

- [ ] CORS 設定を確認
  - [ ] Supabase の「Project Settings」→「API」→「CORS」で、Vercel のドメインを許可リストに追加
- [ ] RLS（Row Level Security）の設定を確認
  - [ ] `supabase/migrations/0002_rls_minimum.sql` が適用されているか確認
  - [ ] 必要に応じて RLS ポリシーを調整
- [ ] ブラウザのコンソール（F12）でエラーメッセージを確認
  - [ ] `Missing Supabase environment variables` エラーの場合、環境変数が正しく設定されているか確認
  - [ ] `Failed to fetch` エラーの場合、Supabase の URL とキーが正しいか確認

### 環境変数が反映されない場合

- [ ] Vercel ダッシュボードで環境変数が正しく設定されているか確認
- [ ] 環境変数の適用環境（Production, Preview, Development）を確認
- [ ] デプロイを再実行（環境変数変更後は再デプロイが必要）
- [ ] ビルドログで環境変数が読み込まれているか確認

### 管理画面でデータが表示されない場合

- [ ] Supabase のマイグレーションが正しく適用されているか確認
  - [ ] `reservations` テーブルが存在するか
  - [ ] `treatments` テーブルが存在するか
  - [ ] `app_settings` テーブルが存在するか
- [ ] ブラウザのコンソール（F12）でネットワークエラーを確認
- [ ] Supabase の「Table Editor」でデータが存在するか確認
- [ ] RLS ポリシーが適切に設定されているか確認

### Edge Function が動作しない場合

- [ ] Edge Function が正しくデプロイされているか確認
- [ ] Edge Function の環境変数（LINE 設定）が正しく設定されているか確認
  - [ ] `LINE_CHANNEL_ACCESS_TOKEN` が設定されているか
  - [ ] `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が設定されているか
  - [ ] `WEB_APP_URL` が設定されているか
- [ ] Database Webhooks が正しく設定されているか確認
- [ ] Edge Function のログを確認（Supabase ダッシュボード → Edge Functions → Logs）
- [ ] LINE Messaging API のレート制限に達していないか確認

---

## 参考リンク

- [Vercel 公式ドキュメント](https://vercel.com/docs)
- [Supabase 公式ドキュメント](https://supabase.com/docs)
- [Next.js 公式ドキュメント](https://nextjs.org/docs)

---

## メモ欄

### Supabase 接続情報

- Project URL: `_________________________________`
- Anon Key: `_________________________________`
- Service Role Key: `_________________________________`（Webhook 用）

### Vercel デプロイ情報

- デプロイ URL: `_________________________________`
- カスタムドメイン: `_________________________________`

### LINE 情報

- Channel ID: `_________________________________`
- Channel Secret: `_________________________________`
- Channel Access Token: `_________________________________`
- Webhook URL: `https://your-app.vercel.app/api/webhooks/line`（LINE Webhook 用）

---

## 実装済み機能

以下の機能が実装済みです：

### 管理画面機能

- ✅ 予約一覧の表示（Supabase から取得）
- ✅ 予約作成・変更・キャンセル
- ✅ 来店確認（回数リセット）
- ✅ 営業時間・営業日の設定
- ✅ 施術メニューの CRUD
- ✅ アクセスログの表示・管理
- ✅ IP アドレス管理
- ✅ LINE メッセージ再送機能（Edge Function 連携）

### データベース連携

- ✅ Supabase クライアント設定
- ✅ 型定義ファイル（`database.types.ts`）
- ✅ 予約管理（`reservations.ts`）
- ✅ 設定管理（`settings.ts`）
- ✅ 施術メニュー管理（`treatments.ts`）
- ✅ アクセスログ管理（`access-logs.ts`）
- ✅ 回数管理（`counters.ts`）
- ✅ 予約可能時間算出（`availability.ts`）

### 注意事項

1. **IP 制限について**

   - フロントエンド側では基本的な IP チェックとログ記録を実装
   - セキュリティのため、実際のアクセス制御はサーバー側（Next.js Middleware または Supabase Edge Function）で実装することを推奨

2. **LINE ユーザー ID**

   - 予約作成時は LINE ユーザー ID（例: `U1234567890abcdef1234567890abcdef`）が必要
   - 管理画面から電話予約を登録する場合は、LINE ユーザー ID を手動入力または検索機能を使用

3. **環境変数**
   - ローカル開発時は `.env.local` ファイルを作成し、以下を設定:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
     ```

---

**最終更新日**: 2024 年
**バージョン**: 2.0（実装完了版）
