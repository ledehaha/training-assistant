const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/training.db');
const db = new Database(dbPath);

try {
  // 查看数据库表结构
  const tableInfo = db.pragma('table_info(courses)');
  console.log('=== courses 表结构 ===');
  tableInfo.forEach(col => {
    console.log(`${col.name}: ${col.type}`);
  });

  // 查看课程数据
  const courses = db.prepare('SELECT id, name, teacher_id, teacher_name, teacher_title FROM courses WHERE is_template = 0 LIMIT 5').all();
  console.log('\n=== 课程数据（前5条）===');
  courses.forEach(course => {
    console.log(`ID: ${course.id}`);
    console.log(`  name: ${course.name}`);
    console.log(`  teacher_id: ${course.teacher_id}`);
    console.log(`  teacher_name: ${course.teacher_name}`);
    console.log(`  teacher_title: ${course.teacher_title}`);
    console.log('');
  });

} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
