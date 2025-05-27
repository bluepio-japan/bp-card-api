const { google } = require('googleapis');
require('dotenv').config(); // .envを読み込む

// Google Sheets APIのクライアント初期化関数
async function initializeGoogleSheets() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // JSONキーのパス
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        return sheets;
    } catch (error) {
        console.error('Google Sheets API 初期化中にエラー:', error);
        throw error;
    }
}

// スプレッドシートのカード名リストを取得する関数
async function getCardList() {
    try {
        const sheets = await initializeGoogleSheets();
        const spreadsheetId = process.env.SPREADSHEET_ID; // .env からスプレッドシートIDを取得
        const sheetName = process.env.SHEET_NAME || 'CardList'; // .env からシート名を取得（デフォルトは CardList）

        const range = `${sheetName}!A:A`; 

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        if (!response.data.values || response.data.values.length === 0) {
            console.warn(`スプレッドシート「${sheetName}」にデータがありません。`);
            return [];
        }

        return response.data.values.flat(); // 1次元配列として返す
    } catch (error) {
        console.error('スプレッドシートのデータ取得に失敗:', error);
        throw error;
    }
}

module.exports = { getCardList };