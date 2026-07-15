import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { getSession, getMessages, saveMessage, saveImage, updateSession } from '@/lib/storage';
import { Message, GeneratedImage } from '@/types';
import path from 'path';
import fs from 'fs/promises';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');
const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function POST(req: NextRequest) {
  try {
    if (!apiKey || apiKey === "ここにあなたのAPIキーを貼り付け") {
      return NextResponse.json({ error: 'Gemini API キーが設定されていません。' }, { status: 500 });
    }

    const { sessionId, text, inputImage, messageId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'セッションIDがありません。' }, { status: 400 });
    }

    // 1. ユーザーのメッセージを履歴に保存
    const userMessage: Message = {
      id: messageId || uuidv4(),
      sender: "user",
      text: text || "",
      timestamp: new Date().toISOString(),
      inputImage: inputImage, 
    };
    await saveMessage(sessionId, userMessage);

    // 2. 利用するモデルの指定
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });

    // 3. 【フェーズ3】会話の記憶（履歴）を読み込む
    const allMessages = await getMessages(sessionId);
    
    // スライディングウィンドウ方式：直近の5件のやり取りだけを記憶として持たせる（トークン節約のため）
    const recentMessages = allMessages.slice(-5);

    // 4. 【フェーズ3】直前に生成された画像を「この画像のことだよ」と教えるために探す
    let latestImageBase64: string | null = null;
    
    // 履歴を後ろ（最新）から遡って、画像を見つけたら読み込む
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (msg.generatedImages && msg.generatedImages.length > 0) {
        const latestImgInfo = msg.generatedImages[msg.generatedImages.length - 1];
        try {
          const imagePath = path.join(DATA_DIR, sessionId, 'images', latestImgInfo.filename);
          const imageBuffer = await fs.readFile(imagePath);
          latestImageBase64 = imageBuffer.toString('base64');
          break; // 見つけたらそこで探すのをやめる
        } catch (err) {
          console.error("過去の画像読み込みエラー:", err);
        }
      }
    }

    // 5. AIに渡す「今の発言」のパーツを組み立てる
    const currentParts: any[] = [];
    if (text) {
      currentParts.push({ text });
    }
    
    // ユーザーがアップロードした画像があればそれを渡す
    if (inputImage) {
      currentParts.push({
        inlineData: {
          mimeType: inputImage.mimeType,
          data: inputImage.data.replace(/^data:image\/\w+;base64,/, ''),
        }
      });
    } 
    // もしアップロードされていなくて、過去に作った画像があれば、それを「参考画像」として渡す
    else if (latestImageBase64) {
      currentParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: latestImageBase64,
        }
      });
      // AIが画像をそのまま「オウム返し」してしまうのを防ぐための強い指示をこっそり混ぜます
      currentParts.push({
        text: "\n\n【システム指示：上記の参考画像を解析し、ユーザーの指示を取り入れた『全く新しい画像』を一から生成してください。参考画像をそのまま出力すること（オウム返し）は絶対に禁止です。必ず新しい画像を出力してください。】"
      });
    }

    // 6. 記憶（履歴）の構築
    const contents: any[] = [];
    // 過去のやり取りをGeminiの形式に変換（テキストのみを記憶させる）
    for (const msg of recentMessages) {
      // 一番最後のメッセージ（今送ったもの）は currentParts で渡すので除外
      if (msg.id === userMessage.id) continue;
      
      const role = msg.sender === 'ai' ? 'model' : 'user';
      if (msg.text) {
        contents.push({ role, parts: [{ text: msg.text }] });
      }
    }
    // 最後に「今の発言＋対象の画像」を追加
    contents.push({ role: 'user', parts: currentParts });

    // 7. AIに考えさせる
    const generationConfig = {
      responseModalities: ["TEXT", "IMAGE"],
    };

    const result = await model.generateContent({
      contents: contents, // 過去の記憶を含めた会話全体を渡す
      generationConfig: generationConfig as any,
    });

    const response = await result.response;
    
    let responseText = "";
    const generatedImages: GeneratedImage[] = [];

    // 8. 結果の処理
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        responseText += part.text;
      } else if (part.inlineData) {
        const imageId = uuidv4();
        const filename = `${imageId}.png`;
        
        await saveImage(sessionId, filename, part.inlineData.data);
        
        generatedImages.push({
          id: imageId,
          filename,
          prompt: text || "画像生成",
          version: 1,
          parentImageId: null,
        });
      }
    }

    // 9. セッション情報の更新
    const session = await getSession(sessionId);
    if (session) {
      if (generatedImages.length > 0) {
        session.imageCount += generatedImages.length;
      }
      session.updatedAt = new Date().toISOString();
      await updateSession(session);
    }

    // 10. AIからの返答を保存
    const aiMessage: Message = {
      id: uuidv4(),
      sender: "ai",
      text: responseText || "画像を生成しました！",
      timestamp: new Date().toISOString(),
      generatedImages: generatedImages.length > 0 ? generatedImages : undefined,
    };

    await saveMessage(sessionId, aiMessage);

    return NextResponse.json(aiMessage);
    
  } catch (error: any) {
    console.error("Chat API でエラーが発生しました:", error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
