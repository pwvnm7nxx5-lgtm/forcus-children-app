# 漢字なぞりプリント

小学三年生向けの漢字なぞりプリントを作る静的Webアプリです。

## 使い方

1. `index.html` をブラウザで開きます。
2. 文章を入力します。
3. 必要に応じて薄さ、文字サイズ、列数、行数を調整します。
4. `印刷 / PDF保存` から印刷、またはブラウザの保存先で `PDFに保存` を選びます。

画面上部の `使い方` から、教師向けの詳しい説明書（`guide.html`）を開けます。

読み仮名を付ける場合は、`読み仮名を付ける` を選び、`読み仮名を作る` を押します。本文から読みを自動作成したあと、右側の一覧で単語ごとの読み、1字ずつに分けるか、まとめて表示するかを確認・修正できます。黄色の「要確認」は、分け方を自動判定できなかった項目です。

文章の一部をなぞらせず濃い見本文字にする場合は、対象を `'...'` で囲みます。文章欄で文字を選択し、`B` ボタンを押して指定することもできます。記号自体はプリントへ表示されません。

## 読みの分割

キーボードでは、読み欄で Alt+下矢印 または F2 を押すと同じ行の表示方法に移動できます。左右キーで選び、Enter または Space で決定し、Escape で読み欄に戻ります。通常の Tab は読み欄と分割した字ごとの入力をすばやく移動します。

読みの自動作成は、同梱した Kuromoji の文・トークン分割を使ったあと、次の順で exact lookup を行います。

1. ブラウザ内に保存した先生の修正
2. `reading-word-map.js` のアプリ所有 override
3. `vendor/jmdict-furigana/` の JmdictFurigana 生成 shard
4. 漢字ごとの候補を使う汎用 aligner
5. 分割できない場合の「要確認」グループ

JmdictFurigana は単語の読み分けデータであり、文 parser ではありません。現在の生成 asset は JmdictFurigana `2.3.1+2026-07-25`、常用漢字 2,136 字 scope、200,511 exact entries、32 shard です。生成総量は約 18.45 MB（manifest 7,095 bytes を含む）で、本文の token surface と、助詞・助動詞・句読点で区切った最大 4 token の候補から必要な shard だけを取得して browser session 内で cache します。代表的な7件の入力で測った初回取得は manifest 1件＋shard 10件、約 5.78 MB でした（入力文と token surface に依存する代表測定値であり、固定値ではありません）。幅広く使うと cache は全 shard に近づき、合計約 18.4 MB まで増えることがあります。別データセットの JmnedictFurigana / proper-name data はダウンロード・使用していません。ただし JMDict-backed entries に含まれる固有名詞や地名（Tokyo/Osaka など）をこの生成器が分類・除外するわけではありません。フィルターは surface が常用漢字 2,136 字 scope に収まるかだけを見ています。同じ表面形＋読みで source segmentation が衝突する 19 キーは自動結果から除外しています。

先生が読み、分割/まとめ、字ごとの piece を変更すると、surface＋変更前の正規化読みをキーに correction が localStorage へ保存されます。schema/version を確認し、壊れた値は無視します。保存数は 1,500 件を上限に古いものから整理します。データは外部へ送信せず、`学習した読みを消去` で reset できます。

### 辞書データの更新

リリース pin、SHA-256、scope、skip/conflict 件数、各 shard の hash/bytes は `vendor/jmdict-furigana/manifest.json` に記録されます。更新時は worktree のルートで次を実行します。

```text
node scripts/build-kanji-furigana.js
```

公式 scope list を更新する必要がある場合だけ、次を先に実行します。通常の build は checked-in `scripts/joyo-kanji.txt` を使うため、scope 用の多数の request は発生しません。

```text
node scripts/build-kanji-furigana.js --update-joyo-list
```

`今日`、`大人`、`一日` のような熟字訓・文脈依存語は、exact source が存在しても分割を決め打ちせず、アプリ override により grouped/要確認を保ちます。学校語彙の全てが完全ではなく、Jmdict の収録範囲、Kuromoji の tokenization、文脈で読みが変わる語には残余 OOV/要確認があります。

## 共有

読みのキーボード操作には、同梱の reading-keyboard.js も使用します。

`共有URLをコピー` で文章と設定をURL内に保存できます。GitHub Pages、Netlify、社内共有サーバーなどにこのフォルダを置くと、そのURLを送るだけで同じプリントを開けます。

このアプリはサーバー処理を使いません。読み仮名の自動作成には、同梱した Kuroshiro / Kuromoji のブラウザ用ファイルと辞書を使います。`index.html`、`styles.css`、`app.js`、`reading-candidates.js`、`reading-word-map.js`、`reading-dictionary.js`、`reading-corrections.js`、`reading-lookup.js`、`reading-layout.js`、`reading-keyboard.js`、`reading-input-state.js`、`vendor/` を同じ構成で配置してください。ライセンスは `vendor/` 内の各ファイルを確認してください。
