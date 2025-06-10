require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const vision = require('@google-cloud/vision');
const stringSimilarity = require('string-similarity');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json()); 

const cardsRouter = require(path.join(__dirname, '../routes/cards'));
const expansionRouter = require(path.join(__dirname, '../routes/expansion'));
const uploadRouter = require(path.join(__dirname, '../routes/upload'));

const client = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const upload = multer({ dest: 'uploads/' });

// 🔧 APIルーティング設定
app.use('/cards', cardsRouter);
app.use('/expansion', expansionRouter);
app.use('/api/upload', uploadRouter);

module.exports = app;

// 除外ワードと例外
const exclusionKeywords = [
    "進化", "HP", "全国図鑑", "高さ", "重さ", "とくせい", "トラッシュ",
    "抵抗力", "逃げる", "弱点", "サポート", "TRAINER", "トレーナー",
    "グッズ", "SUPPORTER", "STADIUM", "ENERGY", "GOODS", "TRAINER’S グッズ",
    "TRAINER’S サポート", "TRAINER’S スタジアム", "TRAINER'S", "たね", "LV.", "スタジアム", "illus", "Illus",
    "TAG", "TEAM", "Pokémon", "Nintendo", "Creatures", "GAME FREAK", "ポケモン"
];

const exclusionExceptions = [
    "古びたねっこの化石",
    "トレーナーズポスト",
    "エリートトレーナー",
    "コーチトレーナー",
    "ジムトレーナー",
    "スピードスタジアム",
    "カゲツのスタジアム",
    "ゲンジのスタジアム",
    "フヨウのスタジアム",
    "プリムのスタジアム",
    "バトルロードスタジアム",
    "月光のスタジアム",
    "夜明けのスタジアム",
    "ファイティングスタジアム",
    "スタジアムナビ",
    "ターフスタジアム",
    "シュートスタジアム",
    "崩れたスタジアム",
    "エキサイトスタジアム",
    "ポケモン図鑑",
    "ポケモン図鑑HANDY910is"
];

// Google Sheets API設定
const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_RANGE = process.env.SHEET_RANGE || 'カード情報マスター!B2:E';
const EXPANSION_RANGE = process.env.EXPANSION_RANGE || 'エキスパンション!A2:A';

// **スプレッドシートからexpansionのリストを取得** 
async function getExpansionMarks() {
    try {
        const client = await auth.getClient();
        const { data } = await sheets.spreadsheets.values.get({
            auth: client,
            spreadsheetId: SPREADSHEET_ID,
            range: EXPANSION_RANGE
        });

        const expansions = data.values?.flat().map(value => value.trim().toUpperCase()) || [];
        console.log("📘 取得したExpansion一覧:", expansions.slice(0, 10), "...");
        return expansions;
    } catch (err) {
        console.error("❌ Expansionリスト取得エラー:", err);
        return [];
    }
}

// **スプレッドシートからCardListを取得**
async function getCardList() {
    const client = await auth.getClient();
    const { data } = await sheets.spreadsheets.values.get({
        auth: client,
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGE
    });

    return data.values.map(row => ({
        name: (row[0] || "").replace(/&/g, "＆").trim().toLowerCase(),
        expansionMark: (row[1] || "").trim().toUpperCase(),
        cardNumber: (row[2] || "").trim().replace(/\s+/g, ''),
        rare: (row[3] || "").trim().toUpperCase()
    }));
}

// **OCR結果からカード名・エキスパンションマーク・カードリスト番号を抽出**
async function extractCardDetails(text) {
    const expansionMarks = await getExpansionMarks();
    const cardList = await getCardList();

    let words = text.replace(/\n/g, ' ').split(/\s+/).filter(Boolean);

// **除外ワード適用（完全一致 & 単語単位で適用）**
    words = words.filter(word =>
        !exclusionKeywords.some(keyword =>
            new RegExp(`^${keyword}$`, 'i').test(word.replace(/[’']/g, "'"))  // アポストロフィ統一
        ) || exclusionExceptions.includes(word)
    );

    // カード名候補を取得
    let nameCandidates = words.filter(word => word.length > 1 && !/\d/.test(word));
    let name = nameCandidates.join(' ').trim();

    console.log("✅ OCR抽出後の name:", name);

    // **エキスパンションマークの取得**
    const expansionCandidates = (text.match(/\b([A-Za-z0-9+乱\-]{1,6})\b/g) || []).map(e => e.toUpperCase());
    console.log("🔍 OCR Expansion 候補:", expansionCandidates);

    let expansion = "該当なし";
    if (expansionCandidates.length > 0) {
        const joinedCandidates = expansionCandidates.join('').toUpperCase();
        const cleanedCandidates = [joinedCandidates, ...expansionCandidates]
        .filter(e => e.length >= 2 && e.length <= 6);

        const bestMatch = stringSimilarity.findBestMatch(
            cleanedCandidates.join(' '),
            expansionMarks
        );
        if (bestMatch.bestMatch.rating >= 0.6) {
            expansion = expansionMarks.find(e => e.replace(/-/g, '') === bestMatch.bestMatch.target.replace(/-/g, '')) || bestMatch.bestMatch.target;
        } else {
            for (let candidate of cleanedCandidates) {
                const match = stringSimilarity.findBestMatch(candidate.replace(/-/g, ''), expansionMarks.map(e => e.replace(/-/g, '')));
                if (match.bestMatch.rating >= 0.6) {
                    expansion = expansionMarks.find(e => e.replace(/-/g, '') === candidate.replace(/-/g, '')) || candidate;
                    break;
                }
            }
        }
    }
    console.log("✅ 抽出された Expansion:", expansion);

    // **カード番号の正規化**
    const numberMatch = text.match(/(DPBP#\d{3}|\d{3}\/\d{3}|\d{3}\/(DP-P|PPP|DPt-P|L-P|BW-P|XY-P|SM-P|S-P|SV-P))/);
    const number = numberMatch ? numberMatch[1].replace(/[^\d\/A-Z-]/g, '') : "";

    // **レアリティの取得**
    const rareKeywords = ["UR","HR","SR","SAR","RRR","CSR","CHR","SSR","RR","AR","PR","TR","ACE","PROMO","R","U","C","K","A","H"];
    let rare = "該当なし";
    const textUpper = text.toUpperCase();

    for (let keyword of rareKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(textUpper)) {
            // AとHは特定のexpansionでのみ有効
            if (keyword === "A" && !(expansion === "S3A" || expansion === "S4A")) continue;
            if (keyword === "H" && expansion !== "SM3+") continue;
            rare = keyword;
            break;
        }
    }

    const extractedData = { name, expansion, number, rare };
    console.log("🔍 OCR抽出結果:", extractedData);

    return extractedData;
}

// **カードデータと照合し、最も一致度が高いカードを取得**
function findClosestCard(ocrData, cardList) {
    if (!ocrData || !ocrData.name) {
        console.error("❌ エラー: ocrData または ocrData.name が undefined");
        return "カード名が特定できませんでした";
    }

    // cardList未定義エラーのため、関数引数に明示し、nullチェックを追加
    if (!cardList || !Array.isArray(cardList)) {
        console.error("❌ エラー: cardList が未定義または配列ではありません");
        return "カード名が特定できませんでした";
    }

    // **OCRで抽出したカードデータの統一**
    const normalize = (str) => str.toUpperCase().replace(/＆/g, "&").replace(/\s+/g, " ").trim();
    const ocrName = normalize(ocrData.name);
    const ocrExpansion = normalize(ocrData.expansion);
    const ocrNumber = ocrData.number.trim();
    const ocrRare = normalize(ocrData.rare || "");

        console.log(`📋 照合開始: ${ocrName}, ${ocrExpansion}, ${ocrNumber}, ${ocrRare}`);

    // number 完全一致
    const numberMatches = cardList.filter(c => c.cardNumber === ocrNumber);
    if (numberMatches.length === 1) return numberMatches[0].name;

        if (numberMatches.length > 1) {
        const names = numberMatches.map(c => normalize(c.name));
        const bestMatch = stringSimilarity.findBestMatch(ocrName, names);
        const best = numberMatches.find(c => normalize(c.name) === bestMatch.bestMatch.target);
        if (best) return best.name;
        return numberMatches[0].name;
    }

    // number が一致しない場合
    // ✅ 完全一致のnameかつexpansion一致があれば最優先で出力
    const exactMatch = cardList.find(c =>
        normalize(c.name) === ocrName &&
        normalize(c.expansionMark).replace(/-/g, '') === ocrExpansion
    );
    if (exactMatch) return exactMatch.name;

    const name90Matches = cardList.filter(c => stringSimilarity.compareTwoStrings(ocrName, normalize(c.name)) >= 0.9);
    const expMatches = name90Matches.filter(c => normalize(c.expansionMark) === ocrExpansion);

    if (expMatches.length > 0) {
        const rareMatches = expMatches.filter(c => normalize(c.rare) === ocrRare);
        return (rareMatches.length > 0 ? rareMatches[0] : expMatches[0]).name;
    }
    if (name90Matches.length > 0) {
        const bestMatch = stringSimilarity.findBestMatch(
            ocrName,
            name90Matches.map(c => normalize(c.name))
        );
        return name90Matches.find(c => normalize(c.name) === bestMatch.bestMatch.target)?.name || name90Matches[0].name;
    }

    const partialMatches = cardList.filter(c =>
        normalize(c.name).includes(ocrName) || ocrName.includes(normalize(c.name))
    );
    const strictMatches = partialMatches.filter(c => normalize(c.expansionMark) === ocrExpansion && normalize(c.rare) === ocrRare);
    if (strictMatches.length > 0) return strictMatches[0].name;

    const fallbackBest = stringSimilarity.findBestMatch(
        ocrName,
        cardList.map(c => normalize(c.name))
    );
    const finalMatch = cardList.find(c => normalize(c.name) === fallbackBest.bestMatch.target);
    if (finalMatch && normalize(finalMatch.expansionMark).replace(/-/g, '') === ocrExpansion) {
        return finalMatch.name;
    }
    return finalMatch?.name || "カード名が特定できませんでした";
}

// **画像アップロード処理**
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        const filePath = req.file.path;
        const [result] = await client.textDetection(filePath);
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            return res.status(400).json({ error: "文字が認識されませんでした。" });
        }

        const detectedText = detections[0].description;
        const extractedData = await extractCardDetails(detectedText);
        const cardList = await getCardList();
        const cardName = findClosestCard(extractedData, cardList);

        res.json({
            cardName,
            extractedData
        });

    } catch (error) {
        console.error("エラー:", error);
        res.status(500).json({ error: "サーバーエラーが発生しました。" });
    }
});

// **OCRで検出された不要ワードの削除関数**
function removeUnnecessaryWords(text) {
    const unnecessaryWords = ["TAG TEAM", "Illus", "PROMO"];
    return text.split(' ').filter(word => !unnecessaryWords.includes(word)).join(' ');
}

// **進化形態優先度に基づくカード選択**
function prioritizeEvolution(cards) {
    const evolutionPriority = ['VSTAR', 'V-UNION', 'プリズムスター', 'VMAX', 'BREAK', 'LEGEND'];
    for (const priority of evolutionPriority) {
        const match = cards.find(card => card.name.toUpperCase().includes(priority));
        if (match) return match;
    }
    return null;
}

// **カード名の比較用正規化関数**
function normalizeCardName(name) {
    return name.replace(/＆/g, "&").toUpperCase().trim();
}

// **スプレッドシートとの照合ロジック**
function compareWithSpreadsheet(ocrName, cardList) {
    const normalizedOCR = normalizeCardName(ocrName);
    const matches = cardList.filter(card => normalizeCardName(card.name) === normalizedOCR);
    return matches.length > 0 ? matches[0] : null;
}

// **複数候補から最も適切なカードを選定**
function selectBestCandidate(ocrData, candidates) {
    if (candidates.length === 1) return candidates[0];

    // 進化形態優先
    const evolutionPriorityMatch = prioritizeEvolution(candidates);
    if (evolutionPriorityMatch) return evolutionPriorityMatch;

    // 名前の類似度が高いものを優先
    const bestMatch = stringSimilarity.findBestMatch(
        ocrData.name.toUpperCase(),
        candidates.map(card => card.name.toUpperCase())
    );
    return bestMatch.bestMatch.rating > 0.7 ? candidates.find(
        card => card.name.toUpperCase() === bestMatch.bestMatch.target
    ) : null;
}

// **エラー処理ロジック**
process.on('uncaughtException', (error) => {
    console.error("❌ 未捕捉エラー:", error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("⚠️ 未捕捉のプロミス拒否:", reason);
});


// **サーバー起動**
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});

// **ローカル動作確認用エンドポイント**
app.get('/', (req, res) => {
    res.send('ポケモンカードOCR照合システム 稼働中');
});

// **ヘルスチェックエンドポイント**
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok" });
});