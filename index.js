import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// 明確允許 Vercel 的前端網址
const allowedOrigins = ['https://my-frontend-ashy.vercel.app'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允許的來源：' + origin));
    }
  }
}));

app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
const dbName = 'warehouseDB'; // 資料庫名稱
let db;

async function startServer() {
  try {
    await client.connect();
    db = client.db(dbName);
    app.listen(3000, () =>
      console.log('API server on http://localhost:3000')
    );
  } catch (e) {
    console.error('MongoDB 連線失敗', e);
  }
}

startServer();

// ========== API 路由區 ==========
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
    res.status(500).json({ success: false, message: '伺服器錯誤，登入失敗' });
  }
});

app.get('/api/products', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  
  try {
    const products = await db.collection('products')
      .find()
	  .sort({ client: 1, productCode: 1 })  // 排序依據
	  .limit(limit)
	  .toArray();
	res.json(products);
  } catch (err) {
    res.status(500).json({ success: false, message: '伺服器錯誤，取得 products 失敗' });
  }
});