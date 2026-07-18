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

    // ユーザーからのメッセージを受け取る
    const { sessionId, text, inputImage, messageId, isVideoEnabled } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'セッションIDがありません。' }, { status: 400 });
    }

    // 「動画」というキーワードが入っているか、かつ動画機能が有効（デフォルトtrue）かチェック
    const isVideoMode = isVideoEnabled !== false && text && text.includes("動画");

    // 1. ユーザーのメッセージを履歴に保存
    const userMessage: Message = {
      id: messageId || uuidv4(),
      sender: "user",
      text: text || "",
      timestamp: new Date().toISOString(),
      inputImage: inputImage, 
    };
    await saveMessage(sessionId, userMessage);

    // 2. 利用するモデルの指定（動画モードならgemini-omni-flash-preview、画像ならgemini-3.1-flash-image）
    const modelName = isVideoMode ? "gemini-omni-flash-preview" : "gemini-3.1-flash-image";
    const model = genAI.getGenerativeModel({ model: modelName });

    // 3. 会話の記憶（履歴）を読み込む
    const allMessages = await getMessages(sessionId);
    
    // スライディングウィンドウ方式：直近の5件のやり取りだけを記憶として持たせる（トークン節約のため）
    const recentMessages = allMessages.slice(-5);

    // 4. 直前に生成されたメディア（画像または動画）を探す
    let latestMediaBase64: string | null = null;
    let latestMediaType: 'image' | 'video' = 'image';
    let latestMediaExt: string = '.png';
    
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (msg.generatedImages && msg.generatedImages.length > 0) {
        const latestMediaInfo = msg.generatedImages[msg.generatedImages.length - 1];
        try {
          const mediaPath = path.join(DATA_DIR, sessionId, 'images', latestMediaInfo.filename);
          const mediaBuffer = await fs.readFile(mediaPath);
          latestMediaBase64 = mediaBuffer.toString('base64');
          latestMediaType = latestMediaInfo.mediaType || 'image';
          latestMediaExt = path.extname(latestMediaInfo.filename);
          break;
        } catch (err) {
          console.error("過去のメディア読み込みエラー:", err);
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
          data: inputImage.data.replace(/^data:(image|video)\/\w+;base64,/, ''),
        }
      });
    } 
    else if (latestMediaBase64) {
      // 過去に作ったメディア（画像または動画）を「参考メディア」として渡す
      const mimeType = latestMediaType === 'video' ? 'video/mp4' : 'image/png';
      currentParts.push({
        inlineData: {
          mimeType: mimeType,
          data: latestMediaBase64,
        }
      });
      
      if (isVideoMode) {
        currentParts.push({
          text: "\n\n【システム指示：上記の参考メディア（画像または動画）をコンテキストとして受け取り、ユーザーの指示を取り入れた『新しい動画』を出力してください。元のメディアの構図や動きを可能な限り引き継いでください。】"
        });
      } else {
        currentParts.push({
          text: "\n\n【システム指示：上記の参考画像を解析し、ユーザーの指示を取り入れた『全く新しい画像』を一から生成してください。参考画像をそのまま出力すること（オウム返し）は絶対に禁止です。必ず新しい画像を出力してください。】"
        });
      }
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

    // 7. 動画モードの場合はLongRunning APIを使用、画像モードの場合はgenerateContentを使用
    if (isVideoMode) {
      // 非同期（LongRunning）動画生成APIの呼び出し
      const promptText = text + (latestMediaBase64 ? " (前回と同じ画像の雰囲気で)" : "");
      
      const reqBody = {
        instances: [
          { prompt: promptText }
        ]
      };
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || '動画の生成リクエストに失敗しました。');
      }

      const op = await res.json();
      
      // ポーリング開始の合図をフロントエンドに返す
      return NextResponse.json({
        isPollingRequired: true,
        operationId: op.name,
        sessionId,
        prompt: text || "動画生成",
        messageId: userMessage.id
      });
    }

    // 従来（画像生成）の処理
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
        const isVideo = part.inlineData.mimeType.startsWith('video/');
        const ext = isVideo ? '.mp4' : '.png';
        const imageId = uuidv4();
        const filename = `${imageId}${ext}`;
        
        await saveImage(sessionId, filename, part.inlineData.data);
        
        generatedImages.push({
          id: imageId,
          filename,
          prompt: text || "画像生成",
          version: 1,
          parentImageId: null,
          mediaType: isVideo ? 'video' : 'image',
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
