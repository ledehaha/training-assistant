import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST /api/auth/logout - 用户登出
export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    
    return NextResponse.json({ success: true, message: '已退出登录' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: '退出失败' }, { status: 500 });
  }
}
