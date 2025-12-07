// check_users.js
const { Pool } = require('pg');
require('dotenv').config();

async function checkUsers() {
  const pool = new Pool({
    user: process.env.DB_USER || 'lasalle_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'lasalleserve',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT) || 5432,
  });

  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT id, email, name, role, password FROM users');
    console.log('Users in database:');
    result.rows.forEach(user => {
      console.log(`- ${user.email} (${user.name}) [${user.role}] - password: ${user.password}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUsers();