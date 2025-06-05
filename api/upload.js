//  Vision API 連携とGoogle Sheets書き込み用に必要なモジュールを読み込む
import vision from '@google-cloud/vision';
import { appendRowToSheet } from '../src/utils/googlesheets.js'; 

//  Vision API クライアント初期化
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

      try {
        const { 画像, カード名, EM, カードリスト, レアリティ } = req.body;

        if (!画像 || !カード名) {
          return res.status(400).json({ message: 'Missing image URL or card name' });
        }

        console.log('AppSheetから受信:', { 画像, カード名, EM, カードリスト, レアリティ });

        // Vision API で画像URLを解析
        const [result] = await client.textDetection(画像);
        const detections = result.textAnnotations;
        const ocrText = detections.length > 0 ? detections[0].description.trim() : '';

        console.log('OCR Result:', ocrText);

        // 「撮影」シートに1行追加
        const newRow = [
          '',                         // A列：ID（AppSheet 側で自動生成）
          imageUrl,                   // B列：画像URL
          ocrText,                    // C列：カード名（OCR結果）
          em || '',                   // D列：EM
          cardList || '',             // E列：カードリスト
          rarity || '',               // F列：レアリティ
          '未処理',                    // G列：ステータス
          new Date().toISOString(),   // H列：作成日時
        ];

        await appendRowToSheet('撮影', newRow);

        res.status(200).json({
          message: 'Upload and OCR completed',
          imageUrl: 画像,
          ocrText,
        });
      } catch (error) {
        console.error('❌ OCR failed:', error);
        res.status(500).json({ message: 'OCR failed', error: error.message });
      } 
}