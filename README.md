# Personal Dashboard (Prototype)

## Features
- 日付/時刻（秒更新）
- 予定管理（終日/日時/繰り返し）
- TODO（優先度・期限）
- 買い物リスト
- 今日の一覧
- 現在地3日天気
- 駅時刻表ウィジェット（ODPT APIキー設定で実データ取得、失敗時サンプル表示）
- ニュース（RSS）
- 通知（ブラウザ + 画面内）
- PWA対応
- 各項目の編集（予定/TODO/買い物/駅）

## Run
ローカルで簡易サーバーを起動して `index.html` を開いてください。

PowerShell 例:

```powershell
python -m http.server 8080
```

ブラウザで `http://localhost:8080` にアクセス。

## Notes
- ODPT APIキーは設定パネルから入力します。キー未設定時は駅時刻表をサンプル表示します。
- ニュースは `直接取得 -> allorigins -> codetabs` の順でフォールバックし、失敗時はキャッシュ表示します。
- 通知はブラウザ/PWAの制約に依存します。
