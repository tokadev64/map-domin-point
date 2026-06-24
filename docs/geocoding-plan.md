# 店舗住所の緯度経度一括取得計画

## 目的

`public/data/stores.json`に収録されている4,614店舗について、住所から緯度・経度を取得し、地図を開いた時点で店舗ピンを表示できるデータを生成する。

処理速度よりも、外部サービスへの負荷抑制、途中再開、取得結果の検証可能性を優先する。

## 現状

- 入力データ: `public/data/stores.json`
- 店舗数: 4,614件
  - 道北: 501件
  - 道南: 335件
  - 道央: 2,682件
  - 道東: 1,096件
- 店舗ID重複: 0件
- 必須項目欠落: 0件
- 現在のアプリは、店舗選択時に国土地理院住所検索APIへ問い合わせている
- Gitブランチ: `develop`
- Git remote: `git@github.com:tokadev64/map-domin-point.git`

## 基本方針

1. 国土地理院住所検索APIを第一候補にする。
2. 同じ正規化住所は一度だけ問い合わせる。
3. API呼び出しは逐次実行し、十分な待機時間を設ける。
4. 取得するたびにチェックポイントを保存し、いつでも再開可能にする。
5. 元の`stores.json`を直接破壊せず、中間成果物を経由する。
6. 自動取得結果には取得元、状態、問い合わせ住所を記録する。
7. 自動取得できなかった住所は別ファイルへ出力し、後から補完する。
8. 緯度経度の妥当性を北海道の概略範囲で検証する。

## 想定ファイル構成

```text
scripts/
  geocode-stores.ts
src/
  geocoding/
    constants.ts
    types.ts
    normalize-address.ts
    gsi-client.ts
    checkpoint.ts
public/data/
  stores.json
  stores-geocoded.json
data/
  geocoding/
    checkpoint.json
    unresolved.json
    rejected.json
```

`data/geocoding/checkpoint.json`は生成途中のデータなので、リポジトリへ含めるかどうかを実装時に判断する。再現性を優先する場合はコミット対象、ファイルサイズや更新頻度を優先する場合は`.gitignore`対象とする。

## データ型

既存の`Store`へ直接optional項目を増やすより、ジオコーディング情報をオブジェクトとして分離する。

```ts
export type GeocodeStatus =
  | "matched"
  | "not-found"
  | "invalid-result"
  | "request-error"
  | "pending";

export interface StoreGeocode {
  status: GeocodeStatus;
  latitude: number | null;
  longitude: number | null;
  source: "gsi" | "manual" | null;
  queryAddress: string;
  matchedAddress: string | null;
  geocodedAt: string | null;
  attempts: number;
  error: string | null;
}

export interface GeocodedStore extends Store {
  geocode: StoreGeocode;
}

export interface GeocodingCheckpoint {
  version: 1;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  total: number;
  processed: number;
  stores: GeocodedStore[];
}
```

国土地理院APIが一致住所を返さない場合は、`matchedAddress`を`null`にする。

## 住所の正規化

問い合わせ前に、次の範囲で保守的に正規化する。

- UnicodeをNFKCへ正規化
- 全角スペースを半角スペースへ変換
- 連続する空白を1つへ統合
- 文字列の前後空白を除去
- ハイフン類を代表文字へ統一
- 明らかな建物内表記は、初回検索失敗時のみ段階的に除去

住所を過剰に変更すると誤一致を招くため、次の順序で問い合わせる。

1. 元の完全住所
2. 空白とハイフンのみ正規化した住所
3. 建物名・階数と推定できる末尾を除去した住所
4. 市区町村と町域までの住所

各段階で使用した文字列を`queryAddress`へ保存する。

## 国土地理院APIクライアント

想定エンドポイント:

```text
https://msearch.gsi.go.jp/address-search/AddressSearch?q=<住所>
```

実装条件:

- `fetch`を注入可能にしてテストしやすくする
- リクエストタイムアウトを設ける
- HTTPエラーと結果なしを区別する
- JSONを`unknown`として受け、型ガードで検証する
- 緯度経度が有限数であることを検証する
- 北海道の概略範囲外なら`invalid-result`とする
- User-Agent等について利用条件上必要な指定がないか、実装時に公式情報を再確認する

概略検証範囲は定数化する。

```ts
export const HOKKAIDO_BOUNDS = {
  minimumLatitude: 41.3,
  maximumLatitude: 45.7,
  minimumLongitude: 139.3,
  maximumLongitude: 146.2,
} as const;
```

この範囲判定は誤座標の検出用であり、住所一致の証明には使用しない。

## レート制御

初期値:

- 並列数: 1
- 正常応答後の待機: 1,500〜2,500ミリ秒のランダム値
- HTTP 429または一時エラー後: 指数バックオフ
- 1店舗あたりの最大試行回数: 3回
- 連続エラー上限: 10回。超過時は全処理を安全に停止

すべて定数またはCLI引数として設定可能にする。

4,614件を2秒間隔で処理した場合、単純計算で約2時間34分かかる。同一住所キャッシュにより実際の問い合わせ数は減る可能性がある。

## キャッシュと途中再開

住所単位のキャッシュを使用する。

```ts
export interface AddressCacheEntry {
  normalizedAddress: string;
  geocode: StoreGeocode;
}
```

処理手順:

1. `checkpoint.json`が存在すれば読み込む。
2. 店舗IDで既処理結果を復元する。
3. 正規化住所ごとのキャッシュを構築する。
4. `matched`済み店舗はスキップする。
5. 同一住所の取得結果があればAPIを呼ばず再利用する。
6. 1件処理するごとにメモリ上の状態を更新する。
7. 数件ごと、または一定秒数ごとにチェックポイントをatomic writeする。
8. SIGINT受信時も可能な限りチェックポイントを保存して終了する。

atomic writeは一時ファイルへ書き込み後、renameする方式を使う。

## CLI

想定コマンド:

```text
deno task geocode
deno task geocode -- --resume
deno task geocode -- --retry-failed
deno task geocode -- --limit 100
deno task geocode -- --delay-ms 2000
deno task geocode -- --dry-run
```

必要なオプション:

- `--input`
- `--output`
- `--checkpoint`
- `--resume`
- `--retry-failed`
- `--limit`
- `--delay-ms`
- `--max-attempts`
- `--dry-run`

## 出力

完了時に次を生成する。

- `public/data/stores-geocoded.json`
  - 全店舗とジオコーディング結果
- `data/geocoding/unresolved.json`
  - `not-found`または`request-error`の店舗
- `data/geocoding/rejected.json`
  - 北海道範囲外など、無効と判定した店舗

完了後に十分な検証ができた場合、アプリが読むファイルを`stores-geocoded.json`へ切り替える。

元の`stores.json`は入力原本として残す。

## 自動検証

最低限、次を確認する。

- 出力店舗数が4,614件
- 店舗IDが入力と完全一致
- 店舗順序が入力と一致
- ID重複がない
- 既存フィールドが変更されていない
- `matched`の緯度経度が有限数
- `matched`の緯度経度が北海道概略範囲内
- `matched`以外の緯度経度が`null`
- `processed`と状態別件数の合計が一致
- 同一正規化住所の結果が一貫している

処理終了時に集計を表示する。

```text
total: 4614
matched: ...
not-found: ...
invalid-result: ...
request-error: ...
API requests: ...
cache hits: ...
elapsed: ...
```

## PBT方針

例示UTを中心にせず、fast-checkで次の性質を検証する。

### 住所正規化

- 冪等性: `normalize(normalize(value)) === normalize(value)`
- 前後空白の追加で結果が変わらない
- 正規化結果に連続空白が残らない
- 元の住所を空文字へ壊さない

### 座標検証

- 北海道範囲内の有限座標は受理される
- 境界外座標は拒否される
- `NaN`、`Infinity`は必ず拒否される

### キャッシュ

- 書き込み結果を読み出すと同じ値になる
- 同じ正規化住所はAPI問い合わせ回数を増やさない
- 壊れたチェックポイントから不正な座標を復元しない

### 再開

- 任意の処理位置で中断・再開しても、一括実行と最終結果が一致する
- 既に`matched`の店舗を再問い合わせしない
- 入力順序が常に維持される

## アプリ側の変更

座標化完了後:

1. `Store`または`GeocodedStore`の型を反映する。
2. 店舗一覧読み込み時に座標付きデータを使用する。
3. MapLibreへ全店舗をGeoJSON sourceとして渡す。
4. 店舗数が多いため、低ズーム時はクラスタリングする。
5. 検索・地域・業種フィルターをMapLibreの表示にも反映する。
6. 店舗選択時は既存座標へ移動し、通常は住所検索APIを呼ばない。
7. 座標未取得店舗だけ、現在のオンデマンド住所検索をフォールバックとして残す。

全4,614店舗を個別DOM Markerにしない。MapLibreのGeoJSON sourceとsymbol/circle
layerを使用する。

## modern-web-guidance上の留意事項

- 長時間処理はブラウザではなくDeno CLIで実行する。
- 店舗一覧は現在のページングを維持し、全件DOM描画しない。
- 地図の大量ポイントはクラスタリングする。
- 動的な件数更新は既存のdebounce済みlive regionを維持する。
- キーボード操作とフォーカス表示を維持する。
- 地図だけに情報を依存させず、店舗一覧をアクセシブルな代替表示として残す。

## 実装順序

1. `types.ts`と`constants.ts`へジオコーディング型・設定を追加
2. 住所正規化モジュールを実装
3. 国土地理院APIクライアントを実装
4. チェックポイントとatomic writeを実装
5. CLI引数解析を実装
6. 低速逐次処理、キャッシュ、リトライを実装
7. PBTを実装
8. `--dry-run`と少数件の`--limit`で検証
9. 全件処理を開始
10. 集計と未解決一覧を確認
11. 地図表示を座標済みJSONへ切り替え
12. formatter、linter、型検査、PBT、buildを実行

## 完了条件

- 全4,614店舗について状態が確定している
- 処理を中断・再開できる
- 取得済み住所を再問い合わせしない
- 自動検証がすべて成功する
- 未解決店舗が独立したJSONで確認できる
- アプリが座標済み店舗をクラスタ表示できる
- 座標未取得店舗にフォールバック経路がある
- formatter、linter、型検査、PBT、buildが成功する

## 次セッション開始時の確認事項

1. `develop`ブランチ上で作業しているか確認する。
2. 現在の変更がコミット済みか確認する。
3. 国土地理院住所検索APIの最新の利用条件・レート制限を公式情報で確認する。
4. `checkpoint.json`をGit管理するか決める。
5. 初回は`--dry-run`、続いて`--limit 10`程度で試験する。
6. 試験結果の座標を複数店舗について目視確認してから全件処理する。
