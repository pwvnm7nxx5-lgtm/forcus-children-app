# 特別支援アプリ

連絡帳作成アプリ、漢字なぞりプリント、1年生の計算・かず・とけい、2年生算数プリント、外部教材リンクなどをまとめた入口ページです。

トップページでは、全学年、1〜6年の表示切り替えと、お気に入り登録ができます。

## 開き方

`index.html` をブラウザで開きます。

各アプリは `apps/` の中で独立して動きます。印刷やPDF保存は、それぞれのアプリ画面で行います。

## 新しいアプリの追加

1. `apps/` の中に新しいアプリ用フォルダを作ります。
2. そのフォルダに `index.html`、`styles.css`、`app.js` などを入れます。
3. `apps.config.js` の `window.INTEGRATED_APPS` に1件追加します。
4. 更新履歴に出す場合は `updates.config.js` に1件追加します。

例:

```js
{
  id: "new-tool",
  title: "新しいツール",
  description: "トップページに表示する説明です。",
  category: "教材",
  grades: ["2"],
  tags: ["印刷"],
  href: "apps/new-tool/index.html",
  actionLabel: "開く",
  status: "ready",
  accent: "#6750a4",
}
```

`href` は統合トップページから見た相対パスにします。

## 構成メモ

今後の整理方針は `docs/code-structure.md` にまとめています。

2026年9月時点の全体調査、既知の課題、優先順位と検証結果は [実装状況と完成までの計画](docs/repository-audit-2026-09-05.md) を参照してください。
