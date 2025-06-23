require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(cors());
app.use(express.json()); 

const cardsRouter = require(path.join(__dirname, '../routes/cards'));
const expansionRouter = require(path.join(__dirname, '../routes/expansion'));
const uploadRouter = require(path.join(__dirname, '../routes/upload'));

// 🔧 APIルーティング設定
app.use('/cards', cardsRouter);
app.use('/expansion', expansionRouter);
app.use('/api/upload', uploadRouter);

module.exports = app;

// エラー処理ロジック
process.on('uncaughtException', (error) => {
    console.error("❌ 未捕捉エラー:", error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("⚠️ 未捕捉のプロミス拒否:", reason);
});


// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});

// ローカル動作確認用エンドポイント
app.get('/', (req, res) => {
    res.send('ポケモンカードOCR照合システム 稼働中');
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok" });
});

// テスト用エンドポイントを追加
app.get('/test', (req, res) => {
    res.status(200).send('Test endpoint is working!');
});

// リクエストレベルのエラー処理を追加（serverlessでも明示的な500返却を保証）
app.use((err, req, res, next) => {
    console.error('❗リクエストエラー:', err.stack || err.message || err);
    res.status(500).json({ status: 'error', message: 'サーバーエラーが発生しました。', detail: err.message || 'Unknown error' });
});