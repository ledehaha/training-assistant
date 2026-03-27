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

    // 查看 courses 表结构
    console.log('=== courses 表结构 ===');
    const schemaResult = db.exec(`PRAGMA table_info(courses)`);
    
    if (schemaResult.length > 0) {
      const columns = schemaResult[0].values;
      console.log('字段列表:');
      columns.forEach(col => {
        console.log(`  - ${col[1]} (${col[2]})`);
      });
      
      // 检查是否有 teacherName 字段
      const hasTeacherName = columns.some(col => col[1] === 'teacher_name');
      console.log('');
      console.log('是否有 teacher_name 字段:', hasTeacherName ? '是' : '否');
      console.log('');
    }

    db.close();
  } catch (error) {
    console.error('数据库查询失败:', error.message);
    console.error(error.stack);
  }
}

checkDatabase();
