// 必要なモジュールを読み込む
const express = require('express');
const router = express.Router();
const vision = require('@google-cloud/vision');
const { updateRowInSheet, getCardList } = require('../src/utils/googlesheets');
const { extractCardDetails, findClosestCard } = require('../src/utils/ocrProcessor');

const rawCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (!rawCredentials) {
  throw new Error('環境変数 GOOGLE_APPLICATION_CREDENTIALS_JSON が未設定です。');
}

//  Vision API クライアント初期化
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// POST /api/upload の処理
router.post('/', async (req, res) => {
      try {
        const { id, imageBase64 } = req.body;// GASから送られてくるペイロードを受け取る

        if (!id || typeof imageBase64 !== 'string' || imageBase64.length === 0) { 
          return res.status(400).json({ message: 'Missing record ID or Base64 image data' });
        }

        console.log('GASから受信（Base64画像）:', { id, imageBase64Length: imageBase64.length });

        //  Vision API で画像をbase64として解析
        const [result] = await client.textDetection({
          image: { content: imageBase64 }
        });

        const detections = result?.textAnnotations ?? [];
        const ocrText = detections.length > 0 ? detections[0].description.trim() : '';

        console.log('OCR結果:', ocrText);

        const extractedData = await extractCardDetails(ocrText);
        console.log('OCRから抽出された詳細:', extractedData);

        const cardList = await getCardList(); 
        const ocrCardName = findClosestCard(extractedData, cardList); 
        const ocrEM = extractedData.em; 
        const ocrCardList = extractedData.cardList; 
        const ocrRarity = extractedData.rarity; 

        console.log('照合結果 カード名:', ocrCardName); 
        console.log('抽出結果 EM:', ocrEM); 
        console.log('抽出結果 カードリスト:', ocrCardList); 
        console.log('抽出結果 レアリティ:', ocrRarity); 

        // 撮影シートのID列が一致する行のみ更新
        await updateRowInSheet({
          sheetName: '撮影',
          matchColumn: 'ID',
          matchValue: id,
          updateData: {
            'カード名': ocrCardName,
            'EM': ocrEM,
            'カードリスト': ocrCardList,
            'レアリティ': ocrRarity,
            'OCR_Completed': true 
          }
        });

        res.status(200).json({
          message: 'OCR完了＆更新成功',
          id,
          ocrText,
          ocrCardName,
          ocrEM,
          ocrCardList,
          ocrRarity
        });
      } catch (error) {
        console.error('Node.js処理エラー:', error);
        res.status(500).json({ message: 'Node.js処理失敗', error: error?.message || error?.toString() || 'Unknown error' });
      } 
});

module.exports = router;