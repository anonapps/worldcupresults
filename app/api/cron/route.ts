import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Cron endpoint reachable',
    timestamp: new Date().toISOString(),
  });
}
