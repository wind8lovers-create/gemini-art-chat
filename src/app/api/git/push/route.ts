import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const commitMsg = message || 'Auto backup from GeminiArtChat';

    // 1. 全ての変更をステージング
    await execAsync('git add .');

    // 2. コミットする
    try {
      // コミットメッセージの中にダブルクォーテーションが含まれているとエラーになるためエスケープ
      const safeMsg = commitMsg.replace(/"/g, '\\"');
      await execAsync(`git commit -m "${safeMsg}"`);
    } catch (commitErr: any) {
      // 変更が何もないのにコミットしようとするとエラーになるため、その場合は無視してプッシュへ進む
      if (!commitErr.stdout?.includes('nothing to commit') && !commitErr.message?.includes('nothing to commit')) {
        throw commitErr;
      }
    }

    // 3. GitHubへプッシュ
    // ※ ユーザーのローカル環境で現在のブランチ（通常はmain）にpushします
    const { stdout, stderr } = await execAsync('git push -u origin HEAD');

    return NextResponse.json({ success: true, output: stdout || stderr });
  } catch (error: any) {
    console.error("Git push error:", error);
    return NextResponse.json({ error: error.message || 'Failed to push to GitHub' }, { status: 500 });
  }
}
