import { NextRequest, NextResponse } from 'next/server';

// 职称等级对照表
const titleLevelMapping = {
  academician: [
    '中国科学院院士',
    '中国工程院院士',
    '院士',
  ],
  professor: [
    '教授',
    '教授级高级讲师',
    '教授级高级政工师',
    '教授级高级实验师',
    '研究员',
    '教授级研究员',
    '教授级高级实验员',
    '教授级高级工程师',
    '正高级工程师',
    '教授级高级建筑师',
    '教授级高级城市规划师',
    '教授级高级农艺师',
    '教授级高级畜牧师',
    '教授级高级兽医师',
    '教授级高级水产师',
    '教授级高级技师',
    '主任医师',
    '教授级主任医师',
    '教授级高级经济师',
    '正高级经济师',
    '教授级高级会计师',
    '正高级会计师',
    '教授级高级审计师',
    '教授级高级统计师',
    '教授级高级翻译',
    '教授级高级档案师',
    '教授级高级编辑',
    '教授级高级记者',
    '教授级高级播音指导',
    '教授级高级馆员',
    '教授级高级文博馆员',
    '教授级高级律师',
    '教授级高级公证员',
    '教授级高级工艺美术师',
    '教授级高级编审',
    '教授级高级一级导演',
    '教授级高级一级指挥',
    '教授级高级一级作曲',
    '教授级高级一级演员',
    '教授级高级教练',
    '教授级高级',
    '正高级',
  ],
  other: [
    '副教授',
    '讲师',
    '助教',
    '高级讲师',
    '副研究员',
    '助理研究员',
    '研究实习员',
    '高级工程师',
    '工程师',
    '助理工程师',
    '技术员',
    '副主任医师',
    '主治医师',
    '医师',
    '医士',
    '副主任药师',
    '药师',
    '药剂师',
    '副主任护师',
    '主管护师',
    '护师',
    '护士',
    '副主任技师',
    '主管技师',
    '技师',
    '高级经济师',
    '经济师',
    '助理经济师',
    '经济员',
    '高级会计师',
    '会计师',
    '助理会计师',
    '会计员',
    '高级统计师',
    '统计师',
    '助理统计师',
    '高级翻译',
    '翻译',
    '助理翻译',
    '高级档案师',
    '档案师',
    '助理档案师',
    '高级馆员',
    '馆员',
    '助理馆员',
    '高级文博馆员',
    '文博馆员',
    '助理文博馆员',
    '高级律师',
    '律师',
    '高级公证员',
    '公证员',
    '一级美术师',
    '二级美术师',
    '三级美术师',
    '一级编剧',
    '二级编剧',
    '三级编剧',
    '一级导演',
    '二级导演',
    '三级导演',
    '一级指挥',
    '二级指挥',
    '三级指挥',
    '一级作曲',
    '二级作曲',
    '三级作曲',
    '一级演员',
    '二级演员',
    '三级演员',
    '高级教练',
    '教练',
    '无职称',
    '待确认',
    '未填写',
  ],
};

function getTeacherLevel(title: string): 'academician' | 'professor' | 'other' {
  if (!title) return 'other';
  
  const normalizedTitle = title.trim();
  
  if (titleLevelMapping.academician.some(t => 
    normalizedTitle === t || 
    normalizedTitle.startsWith(t) ||
    normalizedTitle.includes(t + '、')
  )) {
    return 'academician';
  }
  
  if (titleLevelMapping.professor.some(t => 
    normalizedTitle === t || 
    normalizedTitle.startsWith(t) ||
    normalizedTitle.includes(t + '、')
  )) {
    return 'professor';
  }
  
  if (titleLevelMapping.other.some(t => 
    normalizedTitle === t || 
    normalizedTitle.startsWith(t) ||
    normalizedTitle.includes(t + '、')
  )) {
    return 'other';
  }
  
  return 'other';
}

export async function GET(request: NextRequest) {
  const testTitles = ['教授', '副教授', '高级工程师', '研究员', '讲师', '无职称'];
  const results = testTitles.map(title => ({
    title,
    level: getTeacherLevel(title),
    price: getTeacherLevel(title) === 'academician' ? 1500 : getTeacherLevel(title) === 'professor' ? 1000 : 500
  }));
  
  return NextResponse.json({ results });
}
