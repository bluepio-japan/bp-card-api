const { google } = require('googleapis');
require('dotenv').config(); // .envを読み込む

// Google Sheets APIのクライアント初期化関数
async function initializeGoogleSheets() {
    try {
        const rawCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        if (!rawCredentials) {
            throw new Error('環境変数 GOOGLE_APPLICATION_CREDENTIALS_JSON が未設定です。');
        }

        const auth = new google.auth.GoogleAuth({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/spreadsheets'],
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
            console.warn(`スプレッドシートの範囲「${range}」にデータがありません。`);
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
            console.warn(`スプレッドシートの範囲「${range}」にデータがありません。`);
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

async function updateRowInSheet({ sheetName, matchColumn, matchValue, updateData }) {
    try {
        const sheets = await initializeGoogleSheets();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // データ取得（例：A列〜Z列 最大3万行想定）
        const getRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:Z30000`,
        });

        const rows = getRes.data.values || [];
        const headers = rows[0];
        const matchIndex = headers.indexOf(matchColumn);

        if (matchIndex === -1) {
            throw new Error(`列「${matchColumn}」が見つかりません。`);
        }

        const rowIndex = rows.findIndex((row, i) => i > 0 && row[matchIndex] === matchValue);
        if (rowIndex === -1) {
            throw new Error(`一致するID「${matchValue}」が見つかりません。`);
        }

        // 更新内容のマッピング
        const newRow = [...(rows[rowIndex] || [])];
        for (const [key, value] of Object.entries(updateData)) {
            const colIndex = headers.indexOf(key);
            if (colIndex !== -1) {
                newRow[colIndex] = value;
            }
        }

        // ピンポイントでその行を上書き
        const range = `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [newRow],
            },
        });

        return true;
    } catch (error) {
        console.error('行の更新に失敗:', error);
        throw error;
    }
}

module.exports = {
    getCardList,
    getExpansionList,
    appendRowToSheet,
    updateRowInSheet,
};