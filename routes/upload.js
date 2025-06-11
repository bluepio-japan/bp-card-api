// 必要なモジュールを読み込む
const express = require('express');
const router = express.Router();
const vision = require('@google-cloud/vision');
const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { appendRowToSheet, updateRowInSheet } = require('../src/utils/googlesheets');

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

        // imageUrlに完全URLを組み立てる
        const fullImageUrl = `https://www.appsheetusercontent.com/${imageUrl}`;
        console.log('画像完全URL:', fullImageUrl);

        // Axiosで組み立てた完全URLからバイナリ取得
        const response = await axios.get(fullImageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const base64Image = imageBuffer.toString('base64');

        // 🆕 Vision API で画像をbase64として解析
        const [result] = await client.textDetection({
          image: { content: base64Image }
        });

        const detections = result.textAnnotations;
        const ocrText = detections.length > 0 ? detections[0].description.trim() : '';

        console.log('OCR結果:', ocrText);

        // 🔧 OCR結果をそれぞれの変数に代入
        const ocrCardName = ocrText;
        const ocrEM = '';
        const ocrCardList = '';
        const ocrRarity = '';

        // 撮影シートのID列が一致する行のみ更新
        await updateRowInSheet({
          sheetName: '撮影',
          matchColumn: 'ID', // 撮影シートのL列がID
          matchValue: id,
          updateData: {
            'カード名': ocrCardName,
            'EM': ocrEM,
            'カードリスト': ocrCardList,
            'レアリティ': ocrRarity
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