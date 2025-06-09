// 必要なモジュールを読み込む
const express = require('express');
const router = express.Router();
const vision = require('@google-cloud/vision');
const { appendRowToSheet, updateRowInSheet } = require('../src/utils/googlesheets');
require('dotenv').config();

//  Vision API クライアント初期化
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// POST /api/upload の処理
router.post('/', async (req, res) => {
      try {
        const { id, imageUrl, cardName, em, cardList, rarity } = req.body;

        if (!imageUrl || !id) {
          return res.status(400).json({ message: 'Missing image URL or row ID' });
        }

        console.log('AppSheetから受信:', { id, imageUrl, cardName, em, cardList, rarity });

        // Vision API で画像URLを解析
        const [result] = await client.textDetection(imageUrl);
        const detections = result.textAnnotations;
        const ocrText = detections.length > 0 ? detections[0].description.trim() : '';

        console.log('OCR結果:', ocrText);

        // ID行にOCR結果を上書き保存
        await updateRowInSheet({
          sheetName: '撮影',
          matchColumn: 'ID',
          matchValue: id,
          updateData: {
            カード名: ocrText,
            EM: em || '',
            カードリスト: cardList || '',
            レアリティ: rarity || ''
          }
        });

        res.status(200).json({
          message: 'OCR完了＆更新成功',
          id,
          imageUrl,
          ocrText,
          em,
          cardList,
          rarity
        });
      } catch (error) {
        console.error('OCR failed:', error);
        res.status(500).json({ message: 'OCR failed', error: error.message });
      } 
});

module.exports = router;