# 台中市清水國小 一年戊班 電子聯絡簿

## 聯絡簿複製功能

管理員登入後，每筆聯絡簿會顯示「複製」按鈕。按下後會：

- 將日期預設為今天
- 複製原本的內容與標籤
- 以新增模式開啟表單，確認或修改後才會儲存
- 保留原聯絡簿，不會覆蓋原資料

## 常用內容範本

管理員可在「常用範本」中新增、修改及刪除範本。新增或修改聯絡簿時，可從下拉選單選取範本並套用；若編輯區已有文字，系統會先詢問是否覆蓋。

此功能使用 Cloud Firestore 的 `templates` 集合。部署程式後，請同步發布新版 `firestore.rules`，管理員才能新增或修改範本。

## 草稿匣與手動發布

- 新增聯絡簿時可選擇「儲存草稿」或「立即發布」
- 管理員可切換查看全部、已發布及草稿
- 草稿可繼續修改、複製、刪除或發布
- 已發布內容可取消發布並移回草稿匣
- 草稿獨立儲存在 `drafts` 集合，只有指定管理員可讀取

部署程式後必須同步發布新版 `firestore.rules`，否則草稿功能會出現權限錯誤。

## 重要公告與公告期間

- 聯絡簿可勾選「設為重要公告並置頂」
- 重要公告會顯示於首頁最上方
- 可設定公告開始與結束時間，也可以留空
- 尚未開始或已結束的公告不會顯示給家長
- 管理員仍可在「已發布」清單查看排程中及已結束的公告
- 系統每分鐘重新檢查公告時間，不需重新整理頁面

這是一個使用 GitHub Pages 與 Firebase 製作的電子聯絡簿。家長可以公開閱讀，只有指定的 Firebase 管理員帳號可以新增、修改或刪除資料。

目前連接的 Firebase 專案：`maggie115-contact-book`

## 檔案

- `index.html`：頁面結構
- `styles.css`：黑板風格與手機版面
- `app.js`：Firebase 登入、Firestore、月曆與管理功能
- `firestore.rules`：Firestore 安全規則（需貼到 Firebase 控制台發布）

## 發布到 GitHub Pages

1. 在 GitHub 建立新的公開儲存庫，例如 `maggie115-contact-book`。
2. 將本資料夾內的三個網站檔案與本說明上傳到儲存庫根目錄。
3. 開啟儲存庫的 `Settings → Pages`。
4. 在 `Build and deployment` 選擇 `Deploy from a branch`。
5. 選擇 `main` 與 `/ (root)`，然後儲存。

網站網址將類似：

`https://你的帳號.github.io/maggie115-contact-book/`

## 重要安全設定

- Authentication 必須啟用「電子郵件地址／密碼」。
- Firestore 必須使用 `firestore.rules` 內的安全規則，並限制管理員 UID。
- 不要在網站中張貼學生電話、地址、身分證字號或其他敏感個資。
- 若更換 Firebase 管理員，必須同步修改 `app.js` 的 `ADMIN_UID` 與 Firestore Rules。

## 本機測試

Firebase 模組不能直接以 `file://` 穩定執行。可在此資料夾啟動簡單的 HTTP 伺服器：

```bash
python -m http.server 8080
```

再開啟 `http://localhost:8080`。
