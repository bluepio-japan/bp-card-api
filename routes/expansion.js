const express = require('express');
const router = express.Router();
const { getExpansionList } = require('../src/utils/googlesheets');

// エキスパンション一覧を取得して返すルート
router.get('/', async (req, res) => {
    try {
        const expansions = await getExpansionList();
        res.json(expansions);
    } catch (error) {
        console.error('❌ エキスパンション一覧の取得エラー:', error);
        res.status(500).json({ error: 'エキスパンション一覧の取得に失敗しました。' });
    }
});

module.exports = router;