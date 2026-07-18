import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// data/sessions フォルダの場所
const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

/**
 * 【画像配信用API】
 * URL: /api/images/[sessionId]/[filename]
 * 
 * パソコンの中のフォルダ（data/sessions/...）に保存されている画像ファイルを、
 * ブラウザに「本物の画像」として表示するための特別な通り道です。
 */
export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ sessionId: string, filename: string }> }
) {
  try {
    const { sessionId, filename } = await params;
    
    // 画像が保存されている実際の場所（パス）を組み立てます
    const imagePath = path.join(DATA_DIR, sessionId, 'images', filename);
    
    // 画像ファイルを読み込みます
    const imageBuffer = await fs.readFile(imagePath);
    
    // ファイルの拡張子によってContent-Typeを出し分ける
    const isVideo = filename.toLowerCase().endsWith('.mp4');
    const contentType = isVideo ? 'video/mp4' : 'image/png';

    // ブラウザに「これはPNG画像ですよ（または動画ですよ）」と教えてあげて、データを返します
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // 1年間キャッシュ（高速化）
      },
    });
  } catch (error) {
    // 画像が見つからなかった場合
    console.error("画像読み込みエラー:", error);
    return NextResponse.json({ error: '画像が見つかりません' }, { status: 404 });
  }
}
