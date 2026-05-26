# コード構成メモ

このプロジェクトは、ルートの入口ページと `apps/` 配下の独立アプリで構成する。

## ルート

- `index.html`
  - アプリ一覧、検索、学年フィルタ、更新履歴、ブックマークUIの土台。
- `styles.css`
  - ルート入口ページの見た目。
- `apps.config.js`
  - トップページに表示するアプリ一覧。
  - 新しいアプリを追加するときの主な編集場所。
- `updates.config.js`
  - 更新履歴の表示データ。
- `launcher.config.js`
  - 入口ページの固定設定。
  - 学年フィルタや空表示メッセージを管理する。
- `launcher.elements.js`
  - 入口ページで使うDOM参照をまとめる。
- `launcher.updates.js`
  - 更新履歴リストのDOM生成と描画。
- `launcher.panel-ui.js`
  - 更新履歴、ブックマークなどのパネル開閉DOM操作。
- `launcher.storage.js`
  - 入口ページのお気に入り、ブックマークフォルダの保存処理。
  - 既存の localStorage キーを維持する。
- `launcher.filters.js`
  - 入口ページの学年、カテゴリ、検索、お気に入り、ブックマーク絞り込み処理。
- `launcher.filter-ui.js`
  - 学年・カテゴリのフィルタボタンDOM生成。
- `launcher.favorite-ui.js`
  - お気に入りボタンとお気に入りフィルタのDOM反映。
- `launcher.bookmarks.js`
  - ブックマークフォルダのID生成、選択フォルダ判定、アプリ追加/解除の小さな共通処理。
- `launcher.bookmark-ui.js`
  - ブックマークフォルダ選択欄と保存先ダイアログのDOM描画。
- `launcher.card-ui.js`
  - トップページのアプリカードDOM生成。
- `app.js`
  - 入口ページの描画、お気に入り、ブックマークの動作、イベント登録。

## アプリ

各アプリは `apps/<app-id>/` に置く。

基本構成は以下。

- `index.html`
- `styles.css`
- `app.js`
- 必要に応じて `README.md`

トップページから戻るリンクは、アプリ直下の `index.html` から見て `../../index.html` を使う。

## 共通部品

共通化したものは `apps/shared/` に置く。

- `apps/shared/grade2-worksheet.css`
  - 2年生の一部プリントで共通利用する印刷レイアウトCSS。
  - 現在は `capacity-print-grade2`、`length-print-grade2`、`table-graph-print-grade2` が読み込む。

## 追加時の方針

1. まず `apps/<app-id>/` にアプリを作る。
2. トップページに出す場合は `apps.config.js` に追加する。
3. 更新履歴に出す場合は `updates.config.js` に追加する。
4. 複数アプリで使う処理は `apps/shared/` に寄せる。
5. 既存の localStorage キーは、保存済みデータを壊さないため原則変更しない。

## 今後の整理候補

- `app.js` のブックマーク画面操作をさらに分離する。
- `app.js` のブックマーク処理を分離する。
- プリント生成アプリ共通の保存、共有URL、印刷処理を `apps/shared/` に寄せる。
- 3年生プリント本体は一時削除中。再開時は出題仕様を決め直してから追加する。
