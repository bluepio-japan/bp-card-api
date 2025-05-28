// bp-card-api/api/upload.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  const { imageUrl, cardName } = req.body;

  if (!imageUrl || !cardName) {
    return res.status(400).json({ message: 'Missing imageUrl or cardName' });
  }

  console.log('📷 Received upload from AppSheet:', { imageUrl, cardName });

  // ここに Google Cloud Vision API 連携処理を後で追加します（タスク5で案内）

  return res.status(200).json({ message: 'Upload received successfully' });
}