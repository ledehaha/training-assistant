import { getSqlite } from '../storage/database.js';

const sqlite = getSqlite();

if (sqlite) {
  try {
    // 查看数据库表结构
    const columns = sqlite.prepare('PRAGMA table_info(courses)').all();
    console.log('=== courses 表结构 ===');
    columns.forEach(col => {
      console.log(`${col.name}: ${col.type} (notnull: ${col.notnull})`);
    });

    // 查看课程数据
    const courses = sqlite.prepare('SELECT id, name, teacher_id, teacher_name, teacher_title FROM courses WHERE is_template = 0 LIMIT 5').all();
    console.log('\n=== 课程数据（前5条）===');
    console.log('课程数量:', courses.length);
    courses.forEach((course, idx) => {
      console.log(`\n[${idx + 1}] 课程: ${course.name}`);
      console.log(`  ID: ${course.id}`);
      console.log(`  teacher_id: ${course.teacher_id}`);
      console.log(`  teacher_name: ${course.teacher_name}`);
      console.log(`  teacher_title: ${course.teacher_title}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
} else {
  console.error('Database not available');
}
