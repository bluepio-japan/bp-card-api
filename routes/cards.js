const express = require('express');
const router = express.Router();
const { getCardList } = require('../src/utils/googlesheets');

// カード情報一覧を取得して返すルート
router.get('/', async (req, res) => {
    try {
        const cards = await getCardList();
        res.json(cards);
    } catch (error) {
        console.error('❌ カード情報の取得エラー:', error);
        res.status(500).json({ error: 'カード情報の取得に失敗しました。' });
    }
});

module.exports = router;