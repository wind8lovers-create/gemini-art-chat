import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSession, saveMessage, saveImage, updateSession } from '@/lib/storage';
import { Message, GeneratedImage } from '@/types';

const apiKey = process.env.GEMINI_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationId = searchParams.get('operationId');
    const sessionId = searchParams.get('sessionId');
    const prompt = searchParams.get('prompt') || '動画生成';

    if (!operationId || !sessionId) {
      return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
    }

    // Google APIに非同期オペレーションの状態を問い合わせる
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationId}?key=${apiKey}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'ステータス確認に失敗しました。');
    }

    const op = await response.json();

    if (!op.done) {
      // まだ生成中
      return NextResponse.json({ done: false });
    }

    // エラーが返ってきている場合
    if (op.error) {
      throw new Error(op.error.message || '動画の生成中にエラーが発生しました。');
    }

    // 生成完了！動画のURIを取得する
    const samples = op.response?.generateVideoResponse?.generatedSamples;
    if (!samples || samples.length === 0 || !samples[0].video?.uri) {
      throw new Error('動画データが見つかりませんでした。');
    }

    const videoUri = samples[0].video.uri;

    // URIから動画の本体（バイナリデータ）をダウンロードする
    const videoResponse = await fetch(`${videoUri}&key=${apiKey}`);
    if (!videoResponse.ok) {
      throw new Error('動画ファイルのダウンロードに失敗しました。');
    }
    
    const arrayBuffer = await videoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // 動画を保存する
    const imageId = uuidv4();
    const filename = `${imageId}.mp4`;
    
    // storage.ts の saveImage は拡張子に関わらずファイルを保存できる
    await saveImage(sessionId, filename, base64Data);
    
    const generatedImages: GeneratedImage[] = [{
      id: imageId,
      filename,
      prompt,
      version: 1,
      parentImageId: null,
      mediaType: 'video',
    }];

    // セッションの更新
    const session = await getSession(sessionId);
    if (session) {
      session.imageCount += 1;
      session.updatedAt = new Date().toISOString();
      await updateSession(session);
    }

    // AIからのメッセージを作成
    const aiMessage: Message = {
      id: uuidv4(),
      sender: "ai",
      text: "動画を生成しました！",
      timestamp: new Date().toISOString(),
      generatedImages,
    };

    await saveMessage(sessionId, aiMessage);

    return NextResponse.json({ done: true, message: aiMessage });

  } catch (error: any) {
    console.error("Polling API エラー:", error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
