# どうみんポイント取扱店舗 非公式マップ

道民生活応援ポイント（どうみんポイント）の取扱店舗を、地図上で検索・確認するための非公式Webアプリです。

北海道内の取扱店舗4,614件を収録し、地域、業種、店名、住所から絞り込めます。バックエンドを持たない静的サイトとして動作し、GitHub
Pagesで公開できます。

> [!IMPORTANT]
> このリポジトリおよび公開サイトは非公式です。北海道および道民生活応援ポイント事業事務局とは関係ありません。店舗情報は変更される場合があるため、利用前に公式サイトや店頭で確認してください。

## 公開サイト

- <https://tokadev.io/map-domin-point/>
- GitHub Pages標準URL: <https://tokadev64.github.io/map-domin-point/>
- 公式情報: <https://doumin-ouen.pref.hokkaido.lg.jp/>

## 主な機能

- 4,614店舗のクラスタ地図表示
- 道央・道南・道北・道東による地域絞り込み
- 店名・住所・業種のテキスト検索
- 複数業種のOR検索
- 業種別の色分け
- 選択地域の全店舗が収まる地図表示
- 現在の地図表示範囲内にある店舗だけの一覧表示
- 左側の折りたたみ式店舗一覧
- 店舗選択時の地図移動と座標表示
- キーボード操作、フォーカス表示、スクリーンリーダー向け通知

検索条件は次の関係で適用されます。

```text
検索語 AND 地域 AND（選択業種A OR 選択業種B OR ...）
```

## データ

| ファイル                               | 内容                                   |
| -------------------------------------- | -------------------------------------- |
| `public/data/stores.json`              | 元の店舗データ                         |
| `public/data/stores-geocoded.json`     | ジオコーディング情報を含む全店舗データ |
| `public/data/store-points.geojson`     | 地図表示用の軽量GeoJSON                |
| `data/geocoding/manual-overrides.json` | 手動確認した座標                       |
| `data/geocoding/unresolved.json`       | 自動取得できなかった店舗               |
| `data/geocoding/rejected.json`         | 北海道外などの不正な取得結果           |

現在は全4,614店舗の座標を取得済みです。

| 取得方法           |  件数 |
| ------------------ | ----: |
| 国土地理院住所検索 | 4,612 |
| 手動確認           |     2 |
| 未解決             |     0 |

地域別件数:

| 地域 |  件数 |
| ---- | ----: |
| 道央 | 2,682 |
| 道南 |   335 |
| 道北 |   501 |
| 道東 | 1,096 |

## 店舗データの生成

`scripts/generate-stores.ts`は、地域別の店舗一覧から`public/data/stores.json`を生成します。

既定では次のローカルファイルを参照します。

- `D:\downloads\取扱店舗一覧（道北）.md`
- `D:\downloads\取扱店舗一覧（道南）.md`
- `D:\downloads\取扱店舗一覧（道央）.md`
- `D:\downloads\取扱店舗一覧（道東）.md`
- `D:\downloads\取扱店舗一覧（全道）.xlsx`

```bash
deno task generate:data
```

別の入力ファイルを使用する場合は、Markdown
4ファイルとExcelファイルのパスを順番に渡します。詳細は`scripts/generate-stores.ts`を参照してください。

## ジオコーディング

`scripts/geocode-stores.ts`は国土地理院住所検索APIへ逐次問い合わせ、取得結果をチェックポイントへ保存します。

処理上の特徴:

- 並列数1
- 既定で1.5〜2.5秒のランダム待機
- 同一住所のキャッシュ
- 一時エラー時の指数バックオフ
- 店舗ごとのチェックポイント保存
- `Ctrl+C`による安全な中断
- 北海道の概略範囲による座標検証
- 店舗IDを指定した部分再試行

入力と住所候補の確認:

```bash
deno task geocode -- --dry-run
```

少数件での通信確認:

```bash
deno task geocode -- \
  --limit 10 \
  --delay-ms 2000
```

中断後の再開:

```bash
deno task geocode -- --resume
```

失敗した店舗だけを再試行:

```bash
deno task geocode -- \
  --resume \
  --retry-failed
```

地図用GeoJSONの再生成:

```bash
deno task export:points
```

実装方針と検証条件は[`docs/geocoding-plan.md`](docs/geocoding-plan.md)に記載しています。

## 出典

- 地図データ: ©
  [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- 地図表示: [MapLibre GL JS](https://maplibre.org/)
- 住所検索: [国土地理院](https://www.gsi.go.jp/)
- 店舗情報:
  [道民生活応援ポイント公式サイト](https://doumin-ouen.pref.hokkaido.lg.jp/)

## ライセンスと利用上の注意

ソースコードのライセンスは、リポジトリにライセンスファイルが追加されるまで未指定です。

収録データ、地図、住所検索結果には、それぞれの提供元の利用条件が適用されます。ソースコードのライセンスとデータの利用条件は別に扱ってください。
