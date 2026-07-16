import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
    return NextResponse.json({ branch: stdout.trim() });
  } catch (error: any) {
    console.error('Failed to get git branch:', error);
    return NextResponse.json({ error: 'Failed to get branch' }, { status: 500 });
  }
}
