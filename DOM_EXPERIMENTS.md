# X DOM操作 実験ログ

x.com上でDOM操作により各アクションが実行可能かの実験記録。

## 実験環境
- ブラウザ: Chrome (claude-in-chrome経由)
- アカウント: @EngineeredReiwa
- 日付: 2026-04-04

---

## 1. いいね (Like) ✅

### 押す
```js
document.querySelector('[data-testid="like"]').click();
```

### 取り消す
```js
document.querySelector('[data-testid="unlike"]').click();
```

### 状態判定
- 未いいね: `[data-testid="like"]` が存在
- いいね済: `[data-testid="unlike"]` が存在

### 備考
- タイムライン上の全いいねボタン: `querySelectorAll('[data-testid="like"]')` で一覧取得可
- 特定ツイートの特定: 親の `<article>` から `[data-testid="tweetText"]` でテキスト取得可

---

## 2. ツイート投稿 (Post) ✅

### ダイアログを開く
```js
document.querySelector('[data-testid="SideNav_NewTweet_Button"]').click();
```

### テキスト入力
```js
const editor = document.querySelector('[data-testid="tweetTextarea_0"]');
editor.focus();
document.execCommand('insertText', false, 'ツイート内容');
editor.dispatchEvent(new Event('input', { bubbles: true }));
```
- `tweetTextarea_0` 自体が `contenteditable`（子要素ではない）
- `execCommand('insertText')` で入力後、`input` イベント発火が必須（React/DraftJSのstate更新のため）
- これをしないと `tweetButton` が `disabled` のまま

### テキスト書き換え（全消し→再入力）
```js
editor.focus();
document.execCommand('selectAll');
document.execCommand('delete');
document.execCommand('insertText', false, '新しいテキスト');
editor.dispatchEvent(new Event('input', { bubbles: true }));
```

### 投稿
```js
document.querySelector('[data-testid="tweetButton"]').click();
```

### 投稿完了の判定
- ダイアログが閉じる（`tweetButton` が消える）
- URLが `/compose/post` → `/home` に戻る

---

## 3. リプライ (Reply) ✅

### リプライボタンクリック（ダイアログを開く）
```js
document.querySelector('[data-testid="reply"]').click();
```

### テキスト入力 & 送信
ツイート投稿と同じ手順。ボタンのテキストが「Reply」になるだけ。
```js
const editor = document.querySelector('[data-testid="tweetTextarea_0"]');
editor.focus();
document.execCommand('insertText', false, 'リプライ内容');
editor.dispatchEvent(new Event('input', { bubbles: true }));
document.querySelector('[data-testid="tweetButton"]').click(); // テキストは"Reply"
```

### ダイアログを閉じる（送信しない場合）
```js
document.querySelector('[data-testid="app-bar-close"]').click();
```

---

## 4. リツイート / 引用RT

### 実験予定
- [ ] RTボタンクリック
- [ ] メニューから選択

---

## 5. 通知読み取り (Notifications) ✅

### 通知ページを開く
```js
document.querySelector('[data-testid="AppTabBar_Notifications_Link"]').click();
```

### 通知を読み取る
```js
const articles = document.querySelectorAll('[data-testid="notification"]');
articles.forEach(a => {
  console.log(a.textContent.slice(0, 120));
});
```
- 各通知は `<article data-testid="notification">` 
- `.textContent` でユーザー名・日時・本文が全部取れる

---

## 6. フォロー / アンフォロー

### 実験予定

---

## 6. 検索

### 実験予定

---

## data-testid 一覧 (発見済み)

| testid | 用途 |
|--------|------|
| `like` | いいねボタン（未いいね状態） |
| `unlike` | いいねボタン（いいね済み状態） |
| `tweetText` | ツイート本文 |
| `tweetTextarea_0` | 投稿エリア（contenteditable DIV） |
| `tweetTextarea_0_label` | 投稿エリアのプレースホルダー |
| `tweetButton` | 投稿ボタン（Post） |
| `SideNav_NewTweet_Button` | 左サイドバーのPostボタン |
| `app-bar-close` | ダイアログ閉じるボタン |
| `fileInput` | 画像アップロード用input |
| `reply` | リプライボタン |
| `retweet` | リツイートボタン（未確認） |
| `notification` | 通知アイテム（article） |
| `AppTabBar_Notifications_Link` | 通知ページリンク |
| `cellInnerDiv` | リスト系のセル（通知等） |

## data-testid 完全版 (XActions参照)

### ツイート関連
| testid / selector | 用途 |
|-------------------|------|
| `article[data-testid="tweet"]` | ツイート記事要素 |
| `[data-testid="tweetText"]` | ツイート本文 |
| `[data-testid="User-Name"]` | ユーザー名表示 |
| `[data-testid="User-Name"] a[href^="/"]` | ユーザーページリンク |
| `a[href*="/status/"]` | ツイートURLリンク |
| `time` | 投稿時刻 |
| `[data-testid="like"]` | いいねボタン（未いいね） |
| `[data-testid="unlike"]` | いいねボタン（いいね済み） |
| `[data-testid="like"] span span` | いいね数 |
| `[data-testid="reply"]` | リプライボタン |
| `[data-testid="reply"] span span` | リプライ数 |
| `[data-testid="retweet"]` | RTボタン |
| `[data-testid="retweet"] span span` | RT数 |
| `a[href*="/analytics"] span span` | 表示回数 |
| `[data-testid="tweetPhoto"] img` | 画像 |
| `[data-testid="videoPlayer"]` | 動画 |
| `[data-testid="quoteTweet"]` | 引用RT判定 |
| `[data-testid="socialContext"]` | RT判定 |

### プロフィール関連
| testid / selector | 用途 |
|-------------------|------|
| `[data-testid="UserDescription"]` | 自己紹介 |
| `[data-testid="UserLocation"]` | 場所 |
| `[data-testid="UserUrl"]` | Webサイト |
| `[data-testid="UserJoinDate"]` | 登録日 |
| `[data-testid="UserName"] svg[aria-label*="Verified"]` | 認証バッジ |
| `a[href$="/following"] span` | フォロー数 |
| `a[href$="/verified_followers"] span` | フォロワー数 |
| `[data-testid*="UserAvatar"] img` | アバター画像 |

### ユーザーリスト（フォロワー等）
| testid / selector | 用途 |
|-------------------|------|
| `[data-testid="UserCell"]` | ユーザーカード |
| `[data-testid="userFollowIndicator"]` | フォローバック判定 |

### レート制限回避パターン (XActions参照)
- いいね/フォロー: 2-5秒ランダムディレイ
- 10件ごと: 10-20秒パーズ
- スクロール読み込み: `window.scrollTo(0, document.body.scrollHeight)` + 2-3秒待ち
