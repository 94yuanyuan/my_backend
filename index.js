const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
const dbName = 'warehouse'; // 資料庫名稱
let db;

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.collection('users').findOne({ username, password });
    if (user) {
      res.json({ success: true, message: '登入成功！' });
    } else {
      res.json({ success: false, message: '帳號或密碼錯誤' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

async function startServer() {
  try {
    await client.connect();
    db = client.db(dbName);
    app.listen(3000, () => console.log('API server on http://localhost:3000'));
  } catch (e) {
    console.error('MongoDB 連線失敗', e);
  }
}
startServer();