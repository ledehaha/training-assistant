import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config } from 'coze-coding-dev-sdk';

// POST /api/fetch-titles - 读取专业技术岗位等级对照表
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const config = new Config({
      apiKey: process.env.COZE_API_KEY || '',
    });

    const fetchClient = new FetchClient(config);

    const result = await fetchClient.fetch(url);

    return NextResponse.json({
      success: true,
      content: result,
    });
  } catch (error) {
    console.error('Fetch URL error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch URL', details: String(error) },
      { status: 500 }
    );
  }
}
