const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// 数据库路径
const dbPath = path.join(__dirname, '../data/training.db');

console.log('数据库路径:', dbPath);
console.log('');

async function checkDatabase() {
  try {
    // 读取数据库文件
    const fileBuffer = fs.readFileSync(dbPath);
    
    // 初始化 sql.js
    const SQL = await initSqlJs();
    const db = new SQL.Database(fileBuffer);

    // 查询课程模板
    console.log('=== 课程模板数据 ===');
    const coursesResult = db.exec(`
      SELECT id, name, teacher_id, teacherTitle, location 
      FROM courses 
      WHERE is_template = 1 
      LIMIT 10
    `);

    if (coursesResult.length > 0) {
      const courses = coursesResult[0].values;
      const columns = coursesResult[0].columns;
      
      console.log('找到', courses.length, '个课程模板');
      console.log('');

      courses.forEach((row, idx) => {
        console.log(`模板 ${idx + 1}:`);
        console.log(`  ID: ${row[0]}`);
        console.log(`  名称: ${row[1]}`);
        console.log(`  讲师ID (teacher_id): "${row[2] || '(空)'}"`);
        console.log(`  讲师职称 (teacherTitle): "${row[3] || '(空)'}"`);
        console.log(`  地点: ${row[4] || '(空)'}`);
        console.log('');
      });
    } else {
      console.log('未找到课程模板');
    }

    // 查询讲师信息
    console.log('=== 讲师库信息 ===');
    const teachersResult = db.exec(`
      SELECT id, name, title 
      FROM teachers 
      WHERE is_active = 1 
      LIMIT 5
    `);

    if (teachersResult.length > 0) {
      const teachers = teachersResult[0].values;
      const columns = teachersResult[0].columns;
      
      console.log('找到', teachers.length, '个讲师');
      console.log('');

      teachers.forEach((row, idx) => {
        console.log(`讲师 ${idx + 1}:`);
        console.log(`  ID: ${row[0]}`);
        console.log(`  姓名 (name): "${row[1]}"`);
        console.log(`  职称 (title): "${row[2] || '(空)'}"`);
        console.log('');
      });
    } else {
      console.log('未找到讲师');
    }

    // 查询有讲师ID的课程模板
    console.log('=== 有讲师ID的课程模板 ===');
    const coursesWithTeacherResult = db.exec(`
      SELECT c.id, c.name, c.teacher_id, c.teacherTitle, t.name as teacher_name, t.title as teacher_real_title
      FROM courses c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      WHERE c.is_template = 1 AND c.teacher_id IS NOT NULL
      LIMIT 10
    `);

    if (coursesWithTeacherResult.length > 0) {
      const courses = coursesWithTeacherResult[0].values;
      const columns = coursesWithTeacherResult[0].columns;
      
      console.log('找到', courses.length, '个有关联讲师的课程模板');
      console.log('');

      courses.forEach((row, idx) => {
        console.log(`模板 ${idx + 1}:`);
        console.log(`  课程ID: ${row[0]}`);
        console.log(`  课程名: ${row[1]}`);
        console.log(`  讲师ID (teacher_id): "${row[2]}"`);
        console.log(`  讲师职称 (teacherTitle): "${row[3] || '(空)'}"`);
        console.log(`  真实讲师姓名 (teacher_name): "${row[4] || '(空)'}"`);
        console.log(`  真实讲师职称 (teacher_real_title): "${row[5] || '(空)'}"`);
        console.log('');
      });
    } else {
      console.log('未找到有关联讲师的课程模板');
    }

    db.close();
  } catch (error) {
    console.error('数据库查询失败:', error.message);
    console.error(error.stack);
  }
}

checkDatabase();
