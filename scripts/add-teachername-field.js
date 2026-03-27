const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// 数据库路径
const dbPath = path.join(__dirname, '../data/training.db');

console.log('数据库路径:', dbPath);
console.log('');

async function addTeacherNameField() {
  try {
    // 读取数据库文件
    const fileBuffer = fs.readFileSync(dbPath);
    
    // 初始化 sql.js
    const SQL = await initSqlJs();
    const db = new SQL.Database(fileBuffer);

    // 添加 teacher_name 字段
    console.log('添加 teacher_name 字段到 courses 表...');
    db.run('ALTER TABLE courses ADD COLUMN teacher_name TEXT');
    console.log('✓ teacher_name 字段添加成功');
    console.log('');

    // 验证字段是否添加成功
    console.log('验证 courses 表结构...');
    const schemaResult = db.exec(`PRAGMA table_info(courses)`);
    
    if (schemaResult.length > 0) {
      const columns = schemaResult[0].values;
      const hasTeacherName = columns.some(col => col[1] === 'teacher_name');
      
      if (hasTeacherName) {
        console.log('✓ 验证成功：teacher_name 字段已存在');
      } else {
        console.log('✗ 验证失败：teacher_name 字段不存在');
      }
    }
    console.log('');

    // 保存数据库
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log('✓ 数据库已保存');

    db.close();
  } catch (error) {
    console.error('操作失败:', error.message);
    console.error(error.stack);
  }
}

addTeacherNameField();
