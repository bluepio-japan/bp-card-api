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

// SHEET_RANGE を読み込む関数
async function getCardList() {
    try {
        const sheets = await initializeGoogleSheets();
        const spreadsheetId = process.env.SPREADSHEET_ID; // .env からスプレッドシートIDを取得
        const range = process.env.SHEET_RANGE || 'カード情報マスター!B:E';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        if (!response.data.values || response.data.values.length === 0) {
            console.warn(`スプレッドシート「${sheetName}」にデータがありません。`);
            return [];
        }

        return response.data.values;
    } catch (error) {
        console.error('スプレッドシートのデータ取得に失敗:', error);
        throw error;
    }
}

// EXPANSION_RANGE を読み込む関数
async function getExpansionList() {
    try {
        const sheets = await initializeGoogleSheets();
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const range = process.env.EXPANSION_RANGE || 'エキスパンション!A:A';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        if (!response.data.values || response.data.values.length === 0) {
            console.warn(`スプレッドシート「${range}」にデータがありません。`);
            return [];
        }

        return response.data.values.flat();
    } catch (error) {
        console.error('エキスパンション一覧の取得に失敗:', error);
        throw error;
    }
}

// 撮影テーブルに1行追加する関数
async function appendRowToSheet(sheetName, values) {
    try {
        const sheets = await initializeGoogleSheets();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [values],
            },
        });
        return response.data;
    } catch (error) {
        console.error('スプレッドシートへの追加に失敗:', error);
        throw error;
    }
}

module.exports = { getCardList, getExpansionList };