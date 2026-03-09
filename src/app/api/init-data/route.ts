import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST /api/init-data - 初始化模拟数据
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();

    // 初始化讲师数据
    const teachers = [
      { name: '张明教授', title: '正高', expertise: '管理培训,领导力', organization: '某大学商学院', hourly_rate: '2000', rating: '4.9', teaching_count: 45 },
      { name: '李华主任', title: '副高', expertise: '安全生产,应急处理', organization: '某安全研究院', hourly_rate: '1500', rating: '4.8', teaching_count: 38 },
      { name: '王强老师', title: '副高', expertise: '团队建设,沟通技巧', organization: '某培训机构', hourly_rate: '1200', rating: '4.7', teaching_count: 52 },
      { name: '赵芳博士', title: '正高', expertise: '职业素养,职场礼仪', organization: '某大学', hourly_rate: '1800', rating: '4.6', teaching_count: 30 },
      { name: '刘伟专家', title: '副高', expertise: '项目管理,流程优化', organization: '某咨询公司', hourly_rate: '1500', rating: '4.5', teaching_count: 25 },
      { name: '陈静讲师', title: '中级', expertise: '办公软件,数据分析', organization: '某科技公司', hourly_rate: '800', rating: '4.4', teaching_count: 40 },
    ];

    // 初始化场地数据
    const venues = [
      { name: '阳光培训中心', location: '上海市浦东新区张江路888号', capacity: 100, daily_rate: '5000', rating: '4.7', usage_count: 28, facilities: '投影仪、音响、白板、空调、茶歇区' },
      { name: '城市会议厅', location: '上海市黄浦区人民广场', capacity: 80, daily_rate: '3500', rating: '4.6', usage_count: 22, facilities: 'LED大屏、音响系统、茶歇服务' },
      { name: '科技园培训室', location: '上海市徐汇区漕河泾开发区', capacity: 60, daily_rate: '2500', rating: '4.5', usage_count: 18, facilities: '投影仪、白板、网络、空调' },
      { name: '企业大学礼堂', location: '上海市闵行区莘庄', capacity: 200, daily_rate: '8000', rating: '4.4', usage_count: 12, facilities: '大型投影、专业音响、座椅、空调' },
    ];

    // 初始化课程模板数据
    const courseTemplates = [
      { name: '班组长管理技能提升', category: '管理技能', duration: 8, target_audience: '班组长', difficulty: '中级', usage_count: 45, avg_rating: '4.7', description: '提升班组长的团队管理、沟通协调、问题解决能力' },
      { name: '安全生产培训', category: '专业技能', duration: 4, target_audience: '全员', difficulty: '初级', usage_count: 38, avg_rating: '4.6', description: '安全意识培养、危险识别、应急处置' },
      { name: '职业素养与职场礼仪', category: '职业素养', duration: 4, target_audience: '新员工', difficulty: '初级', usage_count: 32, avg_rating: '4.5', description: '职业道德、职场礼仪、沟通技巧' },
      { name: '领导力提升训练', category: '管理技能', duration: 8, target_audience: '中层管理', difficulty: '高级', usage_count: 28, avg_rating: '4.8', description: '领导力理论、决策能力、团队激励' },
      { name: '高效沟通技巧', category: '职业素养', duration: 4, target_audience: '全员', difficulty: '初级', usage_count: 35, avg_rating: '4.4', description: '沟通原理、倾听技巧、表达艺术' },
      { name: '项目管理实战', category: '专业技能', duration: 8, target_audience: '技术骨干', difficulty: '中级', usage_count: 22, avg_rating: '4.6', description: '项目规划、进度控制、风险管理' },
      { name: '团队建设与协作', category: '综合提升', duration: 4, target_audience: '全员', difficulty: '初级', usage_count: 30, avg_rating: '4.5', description: '团队理念、协作技巧、团队游戏' },
      { name: '问题分析与解决', category: '专业技能', duration: 4, target_audience: '班组长', difficulty: '中级', usage_count: 25, avg_rating: '4.3', description: '问题识别、分析方法、解决策略' },
    ];

    // 初始化规范性文件数据
    const normativeDocuments = [
      { name: '培训费用管理办法', type: '费用标准', content: '讲师费标准：正高2000元/课时，副高1500元/课时，中级800元/课时', is_effective: true },
      { name: '住宿费标准', type: '费用标准', content: '一类城市500元/人/天，二类城市350元/人/天，三类城市200元/人/天', is_effective: true },
      { name: '餐饮费标准', type: '费用标准', content: '一类城市150元/人/天，二类城市120元/人/天，三类城市100元/人/天', is_effective: true },
      { name: '培训管理规范', type: '合规条款', content: '培训项目必须经过申报审批，费用必须在预算范围内，培训效果必须进行评估', is_effective: true },
    ];

    // 插入数据
    const { error: teachersError } = await client.from('teachers').insert(teachers);
    const { error: venuesError } = await client.from('venues').insert(venues);
    const { error: coursesError } = await client.from('course_templates').insert(courseTemplates);
    const { error: docsError } = await client.from('normative_documents').insert(normativeDocuments);

    if (teachersError || venuesError || coursesError || docsError) {
      console.error('Insert errors:', { teachersError, venuesError, coursesError, docsError });
      return NextResponse.json({ 
        error: 'Some data failed to insert',
        details: { teachersError, venuesError, coursesError, docsError }
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '初始化数据完成',
      data: {
        teachers: teachers.length,
        venues: venues.length,
        courseTemplates: courseTemplates.length,
        normativeDocuments: normativeDocuments.length,
      }
    });
  } catch (error) {
    console.error('Init data error:', error);
    return NextResponse.json({ error: 'Failed to initialize data' }, { status: 500 });
  }
}
