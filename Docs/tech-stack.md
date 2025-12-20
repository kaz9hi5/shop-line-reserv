# 技術スタック

## システムアーキテクチャ

システムは以下のアーキテクチャを採用します：

```
[Web予約画面]
   ↓（直接CRUD）
[Supabase DB]
   ↓（保存後トリガー）
[Supabase Edge Function]
   ↓
[Twilio SMS]
```

### 各コンポーネントの説明

- **Web 予約画面**: フロントエンド（顧客向け・管理画面）
  - Supabase CRUD に直接接続してデータ操作を実行
- **Supabase DB**: データベース（予約情報、顧客情報、アクセスログの保存）
  - 予約情報は論理削除で管理
  - 予約変更時は既存予約を論理削除し、新規予約を作成
  - データ保存後に Edge Function をトリガーして SMS 送信
- **Supabase Edge Function**: サーバーレス関数（保存後 SMS 送信のみ）
  - DB 保存後に自動的にトリガーされ、SMS 通知を送信
- **Twilio SMS**: SMS 送信サービス

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
  - SMS 認証コードの送信・検証
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
  - 予約フォーム、SMS 認証フォームの実装に適している
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
  - **Supabase Edge Function**: サーバーレス関数（保存後 SMS 送信のみ）
  - **IP アドレス制限機能**: 管理画面へのアクセスを特定 IP アドレスに制限
  - **Row Level Security (RLS)**: データベースレベルでのアクセス制御

### IP アドレス制限の実装

管理画面へのアクセス制限は、Supabase の RLS（Row Level Security）またはフロントエンド側で実装します。

**IP アドレスリストの扱い：**

- アクセスリストに追加した IP アドレスは「許可」として扱う
- リストから削除した IP アドレスは「拒否」として扱う
- ホワイトリスト方式（リストに存在する IP のみ許可、それ以外は拒否）

**実装方法：**

- Supabase RLS で IP アドレスベースのアクセス制御を実装
- または、フロントエンド側で IP アドレスをチェックし、許可 IP 以外からのアクセスをブロック
- 許可 IP アドレスリストは Supabase DB に保存

**アクセスログ機能：**

- すべての管理画面アクセス試行を Supabase DB に記録
- 記録項目：日時、IP アドレス、アクセス結果（許可/拒否）
- IP アドレス選定のためのアクセス履歴確認に利用
- **アクセスログ記録の制御機能**
  - 設定画面からアクセスログの記録を ON/OFF 可能
  - 設定は Supabase DB に保存
  - フロントエンドまたは RLS で設定を参照し、記録の有無を制御

## SMS API

- **Twilio**
  - SMS 認証コードの送信
  - 予約完了通知の送信
  - 予約変更完了通知の送信
  - 予約キャンセル完了通知の送信

### 予約キャンセルの処理フロー

予約キャンセルは以下のフローで実装します（期限内・期限超過どちらも同じ）：

**処理フロー：**

1. フロントエンドから Supabase DB に直接 CRUD 操作を実行
2. 予約情報を論理削除（deleted_at フラグを設定）
3. DB 保存後に Edge Function が自動的にトリガーされ、キャンセル完了の SMS 通知を送信

**実装方法：**

- フロントエンドから Supabase CRUD に直接接続して論理削除を実行
- DB 保存後に Edge Function がトリガーされ、SMS 送信を実行
- 論理削除により予約履歴を保持
- 「キャンセルする」ボタン・「店に行けない」ボタンどちらも同じ処理フロー

### 予約変更の処理フロー

予約変更は以下のフローで実装します：

**処理フロー：**

1. フロントエンドから Supabase DB に直接 CRUD 操作を実行
2. 既存の予約情報を論理削除（deleted_at フラグを設定）
3. 同じ SMS（電話番号）であることを論理削除した予約情報と突合して確認
4. 新たに予約情報を作成
5. DB 保存後に Edge Function が自動的にトリガーされ、予約変更完了の SMS 通知を送信

**実装方法：**

- フロントエンドから Supabase CRUD に直接接続して論理削除と新規作成を実行
- DB 保存後に Edge Function がトリガーされ、SMS 送信を実行
- 日時の変更でも施術内容の変更でも同じ処理フロー
- 論理削除により予約履歴を保持

---

**作成日**: 2024 年
**バージョン**: 1.0
