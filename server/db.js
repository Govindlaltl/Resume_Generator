
const mysql = require('mysql2');

const requiredDatabaseSettings = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME'
];

const missingDatabaseSettings = requiredDatabaseSettings.filter(
  name => process.env[name] === undefined || process.env[name] === ''
);

if (missingDatabaseSettings.length) {
  throw new Error(
    `Missing required database settings: ${missingDatabaseSettings.join(', ')}`
  );
}

const databaseName = process.env.DB_NAME;

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: databaseName
});

const query = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });

const initializeDatabase = new Promise((resolve, reject) => {
  db.connect(async err => {
    if (err) {
      reject(err);
      return;
    }

    try {
      // Create students table
      await query(`
        CREATE TABLE IF NOT EXISTS students (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          roll_number VARCHAR(20) DEFAULT NULL,
          email VARCHAR(100) DEFAULT NULL,
          phone VARCHAR(15) DEFAULT NULL,
          cgpa DECIMAL(3,2) DEFAULT NULL,
          target_career VARCHAR(120) DEFAULT NULL,
          project_details TEXT,
          project_description TEXT,
          section_titles TEXT,
          custom_sections LONGTEXT,
          PRIMARY KEY (id),
          UNIQUE KEY roll_number (roll_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Ensure existing student columns are updated
      await query(
        'ALTER TABLE students MODIFY COLUMN roll_number VARCHAR(20) DEFAULT NULL'
      );

      const studentColumns = [
        { name: 'target_career', type: 'VARCHAR(120) DEFAULT NULL' },
        { name: 'project_details', type: 'TEXT' },
        { name: 'project_description', type: 'TEXT' },
        { name: 'section_titles', type: 'TEXT' },
        { name: 'custom_sections', type: 'LONGTEXT' }
      ];

      for (const column of studentColumns) {
        const exists = await query(
          'SHOW COLUMNS FROM students LIKE ?',
          [column.name]
        );

        if (exists.length === 0) {
          await query(
            `ALTER TABLE students ADD COLUMN ${column.name} ${column.type}`
          );
        }
      }

      // Create certificates table
      await query(`
        CREATE TABLE IF NOT EXISTS certificates (
          id INT NOT NULL AUTO_INCREMENT,
          student_id INT NOT NULL,
          file_path VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) DEFAULT NULL,
          title VARCHAR(255) DEFAULT NULL,
          extracted_text TEXT,
          upload_date TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY student_id (student_id),
          CONSTRAINT certificates_ibfk_1
            FOREIGN KEY (student_id)
            REFERENCES students (id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const extractedTextColumn = await query(
        "SHOW COLUMNS FROM certificates LIKE 'extracted_text'"
      );

      if (extractedTextColumn.length === 0) {
        await query(
          'ALTER TABLE certificates ADD COLUMN extracted_text TEXT AFTER title'
        );
      }

      // Create users table
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT NOT NULL AUTO_INCREMENT,
          student_id INT DEFAULT NULL,
          username VARCHAR(50) NOT NULL,
          email VARCHAR(254) NOT NULL,
          password_hash CHAR(128) NOT NULL,
          password_salt CHAR(32) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY users_username_unique (username),
          UNIQUE KEY users_email_unique (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const userStudentColumn = await query(
        "SHOW COLUMNS FROM users LIKE 'student_id'"
      );

      if (userStudentColumn.length === 0) {
        await query(
          'ALTER TABLE users ADD COLUMN student_id INT DEFAULT NULL AFTER id'
        );
      }

      // Link existing users with students
      const usersToLink = await query(`
        SELECT u.id, u.username, u.email
        FROM users u
        LEFT JOIN students s ON s.id = u.student_id
        WHERE u.student_id IS NULL OR s.id IS NULL
      `);

      for (const user of usersToLink) {
        const matchedStudents = await query(
          'SELECT id FROM students WHERE email = ? LIMIT 1',
          [user.email]
        );

        let studentId;

        if (matchedStudents.length) {
          studentId = matchedStudents[0].id;
        } else {
          const student = await query(
            'INSERT INTO students (name, email) VALUES (?, ?)',
            [user.username, user.email]
          );

          studentId = student.insertId;
        }

        await query(
          'UPDATE users SET student_id = ? WHERE id = ?',
          [studentId, user.id]
        );
      }

      // Ensure unique student relationship
      const studentIndex = await query(
        "SHOW INDEX FROM users WHERE Key_name = 'users_student_unique'"
      );

      if (studentIndex.length === 0) {
        await query(
          'ALTER TABLE users ADD UNIQUE KEY users_student_unique (student_id)'
        );
      }

      // Ensure student foreign key
      const studentForeignKey = await query(
        `
          SELECT CONSTRAINT_NAME
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'users'
          AND CONSTRAINT_NAME = 'users_student_fk'
        `,
        [databaseName]
      );

      if (studentForeignKey.length === 0) {
        await query(`
          ALTER TABLE users
          ADD CONSTRAINT users_student_fk
          FOREIGN KEY (student_id)
          REFERENCES students (id)
          ON DELETE CASCADE
        `);
      }

      await query(
        'ALTER TABLE users MODIFY COLUMN student_id INT NOT NULL'
      );

      // Create user sessions table
      await query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          token_hash CHAR(64) NOT NULL,
          user_id INT NOT NULL,
          expires_at DATETIME NOT NULL,
          PRIMARY KEY (token_hash),
          KEY user_sessions_user_id (user_id),
          CONSTRAINT user_sessions_user_fk
            FOREIGN KEY (user_id)
            REFERENCES users (id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      console.log(`Database "${databaseName}" is ready`);

      resolve();
    } catch (initializationError) {
      reject(initializationError);
    }
  });
});

db.initializeDatabase = initializeDatabase;

module.exports = db;
