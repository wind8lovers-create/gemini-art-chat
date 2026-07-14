import fs from 'fs';
import path from 'path';

// .env.localからAPIキーを読み込む簡易的な処理
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const apiKeyLine = envContent.split('\n').find(line => line.startsWith('GEMINI_API_KEY='));
const apiKey = apiKeyLine ? apiKeyLine.split('=')[1].trim() : '';

if (!apiKey) {
  console.error("APIキーが見つかりません");
  process.exit(1);
}

async function listModels() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await response.json();
  
  if (data.models) {
    const modelNames = data.models.map((m: any) => m.name);
    console.log("利用可能なモデル一覧:");
    console.log(modelNames.join('\n'));
  } else {
    console.error("モデルの取得に失敗しました:", data);
  }
}

listModels();
