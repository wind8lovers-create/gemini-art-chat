import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const apiKeyLine = envContent.split('\n').find(line => line.startsWith('GEMINI_API_KEY='));
const apiKey = apiKeyLine ? apiKeyLine.split('=')[1].trim() : '';

if (!apiKey) {
  console.error("APIキーが見つかりません");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName: string) {
  try {
    console.log(`--- テスト開始: ${modelName} ---`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "可愛い猫の絵を描いて" }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      } as any
    });
    const response = await result.response;
    let hasImage = false;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        hasImage = true;
      }
    }
    console.log(`✅ 成功: ${modelName} (画像あり: ${hasImage})`);
  } catch (e: any) {
    console.log(`❌ 失敗: ${modelName}`);
    console.error(e.message);
  }
}

async function run() {
  await testModel('gemini-2.5-flash-image');
  await testModel('gemini-3.1-flash-image');
  await testModel('gemini-3-pro-image');
  await testModel('gemini-2.5-flash');
}

run();
