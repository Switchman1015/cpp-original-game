# Rogue Terminal: Cloudrunner (MVP)

サイバーパンク端末×ASCIIネットワークで“稼ぎ優先”のローグライク。リアルタイム（RTwP）でコマンドを打ち、クラウド資源（CPU/MEM/NET/POWER/HEAT）を運用しながらノードを襲撃します。

## 主要要素（MVP）
- 端末UI（`xterm.js`）: `map / connect / breach / scan / inject / firewall / lag / overclock / cool / help` 等
- ASCIIネットワークマップ: 右側に動的イベント（弱点窓/封鎖/巡回）を簡易表示
- リアルタイムスケジューラ: `castMs / gcd / cooldown` と資源消費を処理、過負荷でスロットリング
- 稼ぎ重視: `vault`ノードでCredits獲得、短時間バフの急襲窓あり

## セットアップ

1) 依存のインストール

```
npm install
```

2) 開発サーバ

```
npm run dev
```

3) ビルド

```
npm run build
npm run preview
```

4) GitHub Pages
- `main`ブランチにpushすると GitHub Actions がビルドし `gh-pages` にデプロイします。

## 操作例
```
map
connect node-b
breach
scan | inject --payload leak --stack 2 ; firewall up
overclock ; inject --payload burn ; cool --power 30
```

## ライセンス
- 現状未設定（必要に応じて追加）
