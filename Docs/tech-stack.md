# 技術スタック

## システムアーキテクチャ

システムは以下のアーキテクチャを採用します：

```
[LINEアプリ]
   ↓（お友達登録）
[LINE Webhook]
   ↓（ユーザー情報保存）
[Supabase DB (line_users)]
   ↓
[Web予約画面]
   ↓（直接CRUD）
[Supabase DB]
   ↓（保存後トリガー）
[Supabase Edge Function]
   ↓
[LINE Messaging API]
```

### 各コンポーネントの説明

- **LINE アプリ**: 顧客の予約エントリーポイント
  - LINE お友達登録でユーザー情報を取得
  - LINE メッセージで予約通知を受信
- **LINE Webhook**: LINE お友達登録イベントを受信
  - お友達登録時に`line_users`テーブルにユーザー情報を自動保存
  - お友達解除時に`is_friend`フラグを更新
- **Web 予約画面**: フロントエンド（顧客向け・管理画面）
  - LINE お友達登録済みユーザーが予約操作を実行
  - 管理画面のデータベース操作は Edge Function `admin-db-proxy` 経由で実行（端末情報による権限チェック）
- **Supabase DB**: データベース（予約情報、ユーザー情報の保存）
  - 全 9 テーブルを使用（`app_settings`, `admin_allowed_ips`, `staff`, `treatments`, `business_days`, `business_hours_overrides`, `reservations`, `customer_action_counters`, `line_users`）
  - 予約情報（`reservations`）は論理削除で管理
  - 店員情報（`staff`）は論理削除で管理（メンバー編集の削除＝論理削除）
  - その他のテーブルは物理削除で管理
  - 予約変更時は既存予約を論理削除し、新規予約を作成
  - データ保存後に Edge Function をトリガーして LINE メッセージ送信
- **Supabase Edge Function**: サーバーレス関数
  - `send-line-message`: DB 保存後に自動的にトリガーされ、LINE メッセージ通知を送信
  - `admin-db-proxy`: 管理画面のデータベース操作を代理実行し、端末情報に基づく権限チェックを実施
  - `line-webhook`: LINE Webhook イベントを受信し、お友達登録・解除時に`line_users`テーブルを更新
- **LINE Messaging API**: LINE メッセージ送信サービス

## フロントエンド

### フレームワーク

- **React**

  - ユーザーインターフェース構築のための JavaScript ライブラリ
  - コンポーネントベースの開発により、再利用可能な UI 部品を構築
  - 管理画面の複雑な UI（カレンダー、モーダル、一覧）に適している

- **Next.js**（推奨）

  - React ベースのフレームワーク
  - サーバーサイドレンダリング（SSR）と静的サイト生成（SSG）をサポート
  - ルーティング、API Routes、画像最適化などの機能を提供
  - 本番環境でのパフォーマンスと SEO に優れている

- **TypeScript**
  - JavaScript に型システムを追加した言語
  - 型安全性により、開発時のエラーを早期発見可能
  - Supabase の型定義を活用して、データベーススキーマとの整合性を保証

### 開発時の注意（このリポジトリの構成）

- **コマンド実行ディレクトリ**:
  - フロントエンドは `web/` 配下に `package.json` があり、`yarn` / `npm` は **`web/` で実行**します
  - プロジェクトルート（`shop-line-reserv/`）には `package.json` が無いため、ルートで `yarn build` 等を実行するとエラーになります

### Supabase 公式クライアントライブラリ

- **@supabase/supabase-js**
  - Supabase の公式 JavaScript クライアントライブラリ
  - React、Vue、その他のフレームワークで使用可能
  - データベースの CRUD 操作、リアルタイム機能、認証機能を提供

**主な機能：**

- **データベース操作（CRUD）**

  - `supabase.from('table_name').select()` - データ取得
  - `supabase.from('table_name').insert()` - データ挿入
  - `supabase.from('table_name').update()` - データ更新
  - `supabase.from('table_name').delete()` - データ削除（論理削除の場合は update で deleted_at を設定）

- **リアルタイム機能**

  - `supabase.from('table_name').on('*', callback)` - データベース変更のリアルタイム購読
  - 予約情報の変更をリアルタイムで反映可能

- **認証機能**
  - LINE Login による認証
  - セッション管理

**インストール方法：**

```bash
npm install @supabase/supabase-js
```

**使用例：**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// 予約情報の取得
const { data, error } = await supabase
  .from("reservations")
  .select("*")
  .eq("is_deleted", false);

// 予約情報の作成
const { data, error } = await supabase
  .from("reservations")
  .insert({ name, phone, date, treatment_id });

// 予約情報の論理削除
const { data, error } = await supabase
  .from("reservations")
  .update({ deleted_at: new Date().toISOString() })
  .eq("id", reservationId);
```

### その他の推奨ライブラリ

- **React Query / TanStack Query**

  - サーバー状態管理とキャッシュ機能
  - Supabase とのデータフェッチを効率化
  - 自動リトライ、キャッシュ更新、楽観的更新をサポート

- **React Hook Form**

  - フォーム管理ライブラリ
  - 予約フォームの実装に適している
  - バリデーション機能が充実

- **date-fns または dayjs**

  - 日付操作ライブラリ
  - 予約日時の計算、表示フォーマットに使用

- **Zod または Yup**
  - スキーマバリデーションライブラリ
  - TypeScript との相性が良い（Zod 推奨）
  - フォーム入力値の検証に使用

### UI ライブラリ・コンポーネント

- **Tailwind CSS**

  - ユーティリティファーストの CSS フレームワーク
  - 迅速な UI 開発と一貫したデザインシステムの構築に適している
  - レスポンシブデザインの実装が容易

- **shadcn/ui**（推奨）

  - React コンポーネントライブラリ
  - Tailwind CSS と Radix UI をベースにしたアクセシブルなコンポーネント
  - カレンダー、モーダル、フォームなどの UI 部品を提供
  - カスタマイズが容易

- **React Calendar / react-big-calendar**
  - カレンダーコンポーネントライブラリ
  - 管理画面の日別予約カレンダー実装に使用

### 状態管理

- **React Context API + useReducer**

  - 軽量な状態管理ソリューション
  - 小〜中規模のアプリケーションに適している
  - 予約情報、認証状態などのグローバル状態管理に使用

- **Zustand**（オプション）
  - 軽量な状態管理ライブラリ
  - Context API よりもシンプルでパフォーマンスに優れる
  - 必要に応じて採用を検討

### 管理画面のアクセス制御実装

- **AdminAccessContext** (`web/src/components/admin/AdminAccessContext.tsx`)

  - IP アドレスの検出と許可状態を管理する React Context
  - `getClientIp()` を使用して外部 API から IP アドレスを取得
  - IP は **初回取得 + 10 秒おきに自動再取得**（画面側に「IP を再取得」ボタンは置かない）
  - 許可判定は RPC `is_admin_ip_allowed(p_ip, p_device_fingerprint)` を使用（判定は **IP 一致のみ**。`admin_allowed_ips` の direct select はしない）
  - 許可された場合、RPC `touch_admin_allowed_ip_fingerprint(p_ip, p_device_fingerprint)` により `device_fingerprint` を更新（管理画面トップアクセスのたびに更新）

- **AdminAccessGate** (`web/src/components/admin/AdminAccessGate.tsx`)

  - IP アドレスベースのアクセス制御を実装するコンポーネント
  - 許可されていない IP からのアクセスをブロックし、403 エラーを表示
  - 403 画面から現在の IP を許可リストへ追加可能（エラーハンドリング付き）
  - 403 画面で追加する際は、店長名照合に成功した場合でも **`admin_allowed_ips.staff_id` は `null` のまま登録**する（紐づけ編集は IP 管理ページで行う）
  - 追加操作は「店長名（`staff`テーブルの`role=manager`の`name`）の一致」を必須とする（RPC `gate_add_allowed_ip` 内で検証）
  - 403 画面には「IP を再取得」ボタンは置かず、IP 再取得は自動更新で行う

- **IP 管理ページ** (`web/src/app/admin/ip-management/page.tsx`)
  - 許可 IP アドレスリストの管理画面
  - IP の削除（拒否）と、`admin_allowed_ips.staff_id` の編集（スタッフ紐づけ編集）
  - 現在の IP アドレスの自動検出と表示

### 開発ツール

- **ESLint**

  - JavaScript/TypeScript のコード品質チェックツール
  - コーディング規約の統一

- **Prettier**

  - コードフォーマッター
  - コードスタイルの自動統一

- **Husky + lint-staged**
  - Git フック管理ツール
  - コミット前の自動リント・フォーマット実行

### 参考資料・ドキュメント

- **Supabase 公式ドキュメント**

  - https://supabase.com/docs
  - React/Next.js との統合ガイド
  - リアルタイム機能、認証、データベース操作の詳細

- **React 公式ドキュメント**

  - https://react.dev
  - 最新の React 機能とベストプラクティス

- **Next.js 公式ドキュメント**

  - https://nextjs.org/docs
  - ルーティング、API Routes、デプロイメントガイド

- **Supabase + React チュートリアル**
  - Supabase 公式の React 統合チュートリアル
  - 認証、データベース操作、リアルタイム機能の実装例

## バックエンド

- **Supabase**
  - データベース、認証、API 機能を提供
  - **Supabase Edge Function**: サーバーレス関数（保存後 LINE メッセージ送信のみ）
  - **IP アドレス制限機能**: 管理画面へのアクセスを特定 IP アドレスに制限
  - **Row Level Security (RLS)**: データベースレベルでのアクセス制御

### Edge Functions（Deno）とエディタ設定

Supabase Edge Functions は **Deno** で動作し、`https://esm.sh/...` のようなリモート import を使います。
エディタが Node/TypeScript として解釈すると `TS2307`（モジュール/型宣言が見つからない）が出るため、
このリポジトリでは以下を追加して **`supabase/functions` を Deno として解析**するようにしています。

- `.vscode/settings.json`（`deno.enablePaths` に `supabase/functions` を指定）
- `supabase/functions/deno.json`（Deno 用 compilerOptions）

### リポジトリ内のバックエンド資産

詳細は [`supabase/README.md`](../../supabase/README.md) を参照してください。

#### ディレクトリ構成

```
supabase/
├── migrations/                    # DB スキーマ（SQL マイグレーション）
│   ├── 0001_init.sql            # 初期スキーマ（全テーブル定義）
│   ├── 0003_visit_reset_counts.sql  # 来店確認（回数リセット）機能
│   ├── 0004_line_migration.sql   # LINE ユーザー ID への移行
│   ├── 0005_admin_role_and_device.sql  # 店長・店員の権限管理
│   ├── 0006_rls_role_based.sql   # Row Level Security の最小設定とロールベースのRLSポリシー
│   └── 0007_rls_insert_update_delete.sql  # INSERT/UPDATE/DELETE用RLSポリシー
├── functions/                    # Edge Functions（サーバーレス関数）
│   ├── _shared/                 # 共通モジュール
│   │   ├── cors.ts              # CORS ヘッダー設定
│   │   ├── line.ts              # LINE Messaging API 送信クライアント
│   ├── send-line-message/       # LINE メッセージ送信 Edge Function
│   │   └── index.ts             # メイン処理
│   ├── admin-db-proxy/          # 管理画面データベース操作プロキシ Edge Function
│   │   └── index.ts             # メイン処理（端末情報による権限チェック）
│   ├── line-webhook/            # LINE Webhook 受信 Edge Function
│   │   └── index.ts             # お友達登録・解除イベント処理
├── config.toml                   # Supabase CLI 設定（ローカル開発用）
└── README.md                    # Supabase 構成の詳細ドキュメント
```

#### データベーススキーマ（migrations/）

**`0001_init.sql` - 初期スキーマ**

定義されているテーブル：

1. **`app_settings`** - アプリケーション設定（シングルトン）

   - 予約キャンセル・変更期限（1〜48 時間）
   - デフォルト営業時間（開始/終了、昼休憩）

2. **`admin_allowed_ips`** - 管理画面アクセス許可 IP（ホワイトリスト）

   - IP アドレス（主キー）、物理削除対応
   - `role` カラム（`manager` または `staff`）- 店長・店員の権限管理
   - `device_fingerprint` カラム - 端末識別用のデバイスフィンガープリント（管理画面トップアクセスのたびに更新）
   - **ホワイトリスト機能**: このテーブルに登録されている IP アドレスのみ管理画面にアクセス可能

3. **`staff`** - 店員テーブル（新規追加）

   - 店員 ID（主キー）、名前、ロール（`manager` または `staff`）
   - 店長と店員 n の複数の名前が登録可能
   - `admin_allowed_ips`テーブルと n:1 の関係
   - **初期データ**: ロールが`manager`のレコードが登録済み、名前は「店長」
   - **削除方式**: `staff`テーブルは論理削除で運用（`deleted_at`カラムを持つ想定）
   - **削除制約**: 店長（`role=manager`）は削除できない
   - **店員削除時の関連データの扱い**:
     - `business_days` / `business_hours_overrides` の 2 テーブルにある、削除対象店員（`staff_id`一致）のレコードは **物理削除**

4. **`treatments`** - 施術メニュー

   - 名前、概要、施術時間（分）、価格（円）、物理削除対応

5. **`business_days`** - 営業日設定（日毎）

   - 日付（主キー）、状態（営業日/休日/定休日）、`staff_id`（店員 ID、店員の営業日を紐付け）
   - **物理削除テーブル**: `deleted_at`カラムなし、削除は物理削除（`.delete()`）
   - 店員は自分の営業日のみ設定可能（店員 ID で紐付け）

6. **`business_hours_overrides`** - 日毎の営業時間上書き

   - 日付（主キー）、開始/終了時間、昼休憩設定、`staff_id`（店員 ID、店員の営業時間を紐付け）
   - **物理削除テーブル**: `deleted_at`カラムなし、削除は物理削除（`.delete()`）
   - 店員は自分の営業時間のみ設定可能（店員 ID で紐付け）

7. **`reservations`** - 予約情報

   - ユーザー情報（名前、LINE ユーザー ID、LINE 表示名）
   - 施術情報（スナップショット保存）
   - 予約日時（`start_at`, `end_at`）
   - 予約経路（web/phone/admin）
   - `arrived_at` カラム - 来店確認日時
   - 論理削除対応（`deleted_at`カラムあり）
   - 重複予約防止制約（`reservations_no_overlap_active`）

8. **`customer_action_counters`** - ユーザーアクション回数（LINE ユーザー ID 単位）

   - LINE ユーザー ID（主キー）
   - 予約キャンセル回数、予約変更回数を保持
   - **予約変更フローで発生する「既存予約の論理削除」はキャンセル回数にカウントしない**（変更回数のみ +1）
   - 来店確認時に物理削除（レコードを削除）

9. **`line_users`** - LINE ユーザー情報（お友達登録情報）
   - LINE ユーザー ID（主キー）
   - LINE 表示名、名前、プロフィール画像 URL
   - お友達状態（`is_friend`フラグ）
   - お友達解除日時（`unfriended_at`）
   - LINE Webhook を通じて自動保存

**テーブルの削除方式：**

- **論理削除テーブル**（`deleted_at`カラムあり）: `reservations`、`staff`

  - 削除時は`deleted_at`にタイムスタンプを設定
  - データは物理的には残り、履歴として保持可能

- **物理削除テーブル**（`deleted_at`カラムなし）: `app_settings`、`admin_allowed_ips`、`treatments`、`business_days`、`business_hours_overrides`、`customer_action_counters`、`line_users`
  - 削除時はデータベースから完全に削除
  - Edge Function 経由で操作する際、`deleted_at`を参照しないように自動的にフィルタリング
  - `customer_action_counters`は来店確認時に物理削除される

**現在使用中のテーブル一覧（全 9 テーブル）:**

1. `app_settings` - アプリケーション設定
2. `admin_allowed_ips` - 管理画面アクセス許可 IP（ホワイトリスト、ロール・デバイスフィンガープリント）
3. `staff` - 店員テーブル（店長・店員の名前を管理、初期データとして店長レコードが登録済み）
4. `treatments` - 施術メニュー
5. `business_days` - 営業日設定（店員 ID で紐付け）
6. `business_hours_overrides` - 日毎の営業時間上書き（店員 ID で紐付け）
7. `reservations` - 予約情報（LINE ユーザー ID ベース、論理削除）
8. `customer_action_counters` - ユーザーアクション回数（LINE ユーザー ID 単位、来店確認時に物理削除）
9. `line_users` - LINE ユーザー情報（お友達登録情報、LINE Webhook で自動保存）

**主な機能：**

- **自動更新タイムスタンプ**: `set_updated_at()` 関数とトリガー
- **予約終了時刻の自動計算**: `reservations_apply_treatment_snapshot()` 関数
  - 施術時間から `end_at` を自動計算
  - 施術情報をスナップショットとして保存（変更履歴保持）
- **重複予約防止**: `exclude` 制約でアクティブな予約の時間重複を防止

**`0002_rls_minimum.sql` - Row Level Security の最小設定**

- 管理系テーブル（`app_settings`, `admin_allowed_ips`）に RLS を有効化
- デフォルトはアクセス拒否（ポリシー未設定のため）
- 顧客向けテーブルは必要に応じて後から RLS を有効化可能

**注意**: `admin_allowed_ips` テーブルには RLS ポリシーが必要です。初期セットアップのため、パブリックアクセスを許可するポリシーを追加する必要があります（マイグレーション `0005_admin_allowed_ips_rls.sql` を参照）。

**`0003_visit_reset_counts.sql` - 来店確認（回数リセット）**

- **`customer_action_counters`** テーブルを追加（LINE ユーザー ID 単位のキャンセル/変更回数）
- `reservations` に **`arrived_at`** を追加（来店済み記録）
- まとめて処理するための DB 関数 **`mark_arrived_and_reset_counts(reservation_id)`** を追加

**`0004_line_migration.sql` - LINE ユーザー ID への移行**

- `reservations` テーブルに LINE 関連カラムを追加（`line_user_id`, `line_display_name`）
- 電話番号ベースから LINE ユーザー ID ベースへの移行
- 既存データの移行処理を含む

**`0005_admin_role_and_device.sql` - 店長・店員の権限管理**

- `admin_allowed_ips` テーブルに `role` カラムを追加（`manager` または `staff`）
- `device_fingerprint` カラムを追加（端末識別用）
- 端末情報による店長・店員の区別を可能にする

**`0006_rls_role_based.sql` - ロールベースの RLS ポリシー**

- すべての管理テーブルに RLS を有効化
- 店員は `reservations` テーブルのみアクセス可能
- 店長はすべてのテーブルにアクセス可能
- 注意: Edge Function 経由の場合は service_role で RLS をバイパスし、Edge Function 内で権限チェックを実装

**`0007_rls_insert_update_delete.sql` - INSERT/UPDATE/DELETE 用 RLS ポリシー**

- すべてのテーブルに INSERT/UPDATE/DELETE 操作の RLS ポリシーを追加
- Edge Function 経由でアクセスするため、実際の権限チェックは Edge Function 内で実施
- 直接データベースアクセス（もしあれば）のためのフォールバックポリシー

#### Edge Functions（functions/）

**`send-line-message` - LINE メッセージ送信 Edge Function**

- **機能**: LINE Messaging API を使用して LINE メッセージを送信
- **リクエスト**: POST で `to`（LINE ユーザー ID）と `messages`（メッセージ配列）を受け取る
- **CORS 対応**: OPTIONS リクエスト対応
- **必要な環境変数**:
  - `LINE_CHANNEL_ACCESS_TOKEN` - LINE Channel Access Token
  - `LINE_CHANNEL_SECRET` - LINE Channel Secret（Webhook 検証用、必要に応じて）

**`admin-db-proxy` - 管理画面データベース操作プロキシ Edge Function**

- **機能**: 端末情報を取得して権限チェックを行い、データベース操作を実行
- **端末識別**: User-Agent、Accept-Language、Accept-Encoding からデバイスフィンガープリントを生成
- **権限チェック**: `admin_allowed_ips` テーブルから IP アドレスまたはデバイスフィンガープリントでロールを取得
- **ロールベースアクセス制御**:
  - 店員（`staff`）: `reservations`、`business_days`、`business_hours_overrides` テーブルのみアクセス可能
  - 店長（`manager`）: すべてのテーブルにアクセス可能
- **リクエスト形式**: POST で `operation`（select/insert/update/delete/rpc）、`table`、`query`、`data` などを受け取る
- **レスポンス形式**: `{ ok: boolean, data?: any, error?: string, role?: string }`
- **必要な環境変数**:
  - `SUPABASE_URL` - Supabase プロジェクトの URL
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key（RLS をバイパス）

**テーブルタイプの扱い:**

- **物理削除テーブル**（`deleted_at`カラムなし）: `app_settings`、`admin_allowed_ips`、`treatments`、`business_days`、`business_hours_overrides`、`customer_action_counters`

  - 削除操作は物理削除（`.delete()`）を使用
  - `select`、`update`、`delete`操作で`deleted_at`を参照しない（自動的にフィルタリング）
  - 存在しないレコードの削除は成功として扱う（べき等性）

- **論理削除テーブル**（`deleted_at`カラムあり）: `reservations`、`staff`
  - 削除操作は論理削除（`deleted_at`を設定）を使用
  - `select`操作で`deleted_at IS NULL`を条件に追加可能

**削除操作の仕様（Idempotent Operation）:**

- **削除操作はべき等性（Idempotent）を持つ**: 存在しないレコードを削除しようとした場合、エラーではなく成功として扱います
- **理由**: 同じ削除操作を複数回実行しても結果が同じになるべき（べき等性の原則）
- **対象テーブル**: すべてのテーブルで適用されますが、特に物理削除テーブルで重要です
- **実装詳細**:
  - 物理削除テーブルの場合、存在しないレコードの削除は成功として扱います
  - 論理削除テーブル（`reservations`）の場合も同様に、既に削除済みのレコードの削除は成功として扱います
  - エラーメッセージに以下の文字列が含まれる場合、削除は成功として扱われます：
    - `"No rows"` - 削除対象の行が存在しない
    - `"not found"` - レコードが見つからない
    - `"PGRST116"` - Supabase PostgREST のエラーコード（レコードが見つからない）

**エラーメッセージの意味:**

- **`"No rows"`**: 削除操作を実行したが、条件に一致する行が存在しなかったことを示します。これはエラーではなく、削除操作が正常に完了したことを意味します（削除対象が既に存在しない状態）。
- **`"not found"`**: 指定されたレコードが見つからなかったことを示します。削除操作においては、これは正常な状態です（削除対象が既に存在しない）。
- **`"PGRST116"`**: Supabase PostgREST（RESTful API レイヤー）のエラーコードで、レコードが見つからないことを示します。`PGRST116` は「No rows returned」を意味し、削除操作においては正常な状態です。

**`_shared/cors.ts`** - CORS ヘッダー設定

- Edge Functions 用の CORS ヘッダーを定義

**`_shared/line.ts`** - LINE Messaging API 送信クライアント

- LINE Messaging API を使用してメッセージを送信する共通関数
- 環境変数から認証情報を取得して HTTP リクエストを送信
- プッシュメッセージの送信に対応

### IP アドレス制限の実装

管理画面へのアクセス制限は、フロントエンド側で実装します。

**IP アドレスリストの扱い：**

- アクセスリストに追加した IP アドレスは「許可」として扱う
- リストから削除した IP アドレスは「拒否」として扱う
- ホワイトリスト方式（リストに存在する IP のみ許可、それ以外は拒否）

**実装方法：**

- フロントエンド側で IP アドレスをチェックし、許可 IP 以外からのアクセスをブロック
- 許可 IP アドレスリストは Supabase DB に保存（`admin_allowed_ips` テーブル）
- IP アドレスの検出は外部 API（ipify.org）を使用
- `AdminAccessContext` コンポーネントで IP アドレスの検出と許可状態の管理を実装
- `AdminAccessGate` コンポーネントでアクセス制御を実装
- **Edge Function 経由のデータベース操作**: `admin-db-proxy` Edge Function を使用してすべてのデータベース操作を実行
- **端末情報による識別**: User-Agent などのブラウザ情報からデバイスフィンガープリントを生成し、端末を識別
- **ロールベースアクセス制御**: 店長（`manager`）と店員（`staff`）のロールに基づいてアクセス権限を制御
  - 店員: `reservations` テーブルのみアクセス可能
  - 店長: すべてのテーブルにアクセス可能

**IP 管理機能の実装詳細：**

- **IP アドレスの検出**: `getClientIp()` 関数で外部 API から IP アドレスを取得
- **許可状態のチェック**: `isIpAllowed()` 関数で DB から許可 IP リストを確認
- **IP 追加・削除**: `addAllowedIp()` / `removeAllowedIp()` 関数で DB に CRUD 操作を実行
- **状態管理**: React Context API を使用して IP アドレスと許可状態を管理
- **自動更新**: IP 追加・削除時にコンテキストの状態を自動更新し、許可状態を再チェック

**IP アドレス制限（ホワイトリスト）：**

- `admin_allowed_ips`テーブルに登録されている IP アドレスのみ管理画面にアクセス可能
- IP アドレスリストは店長が管理（店長のみアクセス可能）
- ホワイトリスト方式（リストに存在する IP のみ許可、それ以外は拒否）

## LINE API

- **LINE Messaging API**

  - 予約完了通知の送信
  - 予約変更完了通知の送信
  - 予約キャンセル完了通知の送信
  - メッセージ内に予約変更・キャンセル操作ボタンを含める

- **LINE Webhook**

  - LINE お友達登録イベント（`follow`）の受信
  - LINE お友達解除イベント（`unfollow`）の受信
  - LINE メッセージイベントの受信
  - ポストバックイベント（ボタン操作）の受信
  - 署名検証によるセキュリティ確保
  - お友達登録時に`line_users`テーブルにユーザー情報を自動保存
  - LINE Profile API を使用してユーザーの表示名・プロフィール画像を取得

### 予約キャンセルの処理フロー

予約キャンセルは以下のフローで実装します（期限内・期限超過どちらも同じ）：

**処理フロー：**

1. LINE メッセージのボタン操作、または Web アプリから Supabase DB に直接 CRUD 操作を実行
2. 予約情報を論理削除（deleted_at フラグを設定）
3. DB 保存後に Edge Function が自動的にトリガーされ、キャンセル完了の LINE メッセージ通知を送信

**実装方法：**

- LINE メッセージのボタン操作、または Web アプリから Supabase CRUD に直接接続して論理削除を実行
- DB 保存後に Edge Function がトリガーされ、LINE メッセージ送信を実行
- 論理削除により予約履歴を保持
- 「キャンセルする」ボタン・「店に行けない」ボタンどちらも同じ処理フロー

### 予約変更の処理フロー

予約変更は以下のフローで実装します：

**処理フロー：**

1. LINE メッセージのボタン操作、または Web アプリから Supabase DB に直接 CRUD 操作を実行
2. 既存の予約情報を論理削除（deleted_at フラグを設定）
3. 同じ LINE ユーザー ID であることを論理削除した予約情報と突合して確認
4. 新たに予約情報を作成
5. DB 保存後に Edge Function が自動的にトリガーされ、予約変更完了の LINE メッセージ通知を送信

**実装方法：**

- LINE メッセージのボタン操作、または Web アプリから Supabase CRUD に直接接続して論理削除と新規作成を実行
- DB 保存後に Edge Function がトリガーされ、LINE メッセージ送信を実行
- 日時の変更でも施術内容の変更でも同じ処理フロー
- 論理削除により予約履歴を保持

---

**作成日**: 2024 年
**バージョン**: 1.0
