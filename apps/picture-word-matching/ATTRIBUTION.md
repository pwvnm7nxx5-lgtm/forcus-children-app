# 教材用イラストの制作記録

## 現在の教材

現在の240種類のカラーイラストは、この教材用に組み込みの画像生成ツールで制作したものです。採用済みの試作と同じ方向で白背景に実物の形が伝わる絵を生成しています。端末の絵文字フォントや旧OpenMoji素材は現在の問題に使用しません。

制作の共通指示と出力元は`art-generation.json`に記録しています。題材ごとの指示は`art-catalog.js`の`subject`です。実際の画像ファイルは`assets/illustrations/`に保存し、寸法と元画像のハッシュを`art-manifest.json`に記録しています。公開する教材からローカルの元PNGへのアクセスは必要ありません。

元PNGを保持したままWebP形式へ変換しています。アプリでは素材の各領域を縦横比を保って表示します。生成画像の照合は担当者自身が行っており、独立した専門家による審査や児童による認識テストを実施したという意味ではありません。

## 旧版の素材

`assets/`直下に残しているSVGと`LICENSE-OpenMoji.txt`は旧版の記録です。現在の出題データからは参照しません。

旧SVGの作者はOpenMoji contributors（HfG Schwäbisch Gmünd）です。出典はhttps://openmoji.org/ および https://github.com/hfg-gmuend/openmoji です。取得元コミットは`626bdc684b85738ebdba73ad83c499c2eb88c5dd`です。

旧SVGはCreative Commons Attribution-ShareAlike 4.0 International（CC BY-SA 4.0）で提供されています。条件はhttps://creativecommons.org/licenses/by-sa/4.0/ と同梱ライセンスを参照してください。この旧素材のライセンス表記を新しい生成画像やアプリのコード全体に適用するものではありません。
