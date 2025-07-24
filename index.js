import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// 明確允許 Vercel 的前端網址
const allowedOrigins = ['https://my-frontend-yuan.vercel.app'];

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

app.post('/api/products/page', async (req, res) => {
  const { page = 1, pageSize = 1, keyword = '', dtAt = 0 } = req.body; // 預設值,防undefined
  
  try {
	const skip = (page - 1) * pageSize;
	
    // Step 1: 計算 dtAt 對應的日期
    let dateFilter = null;
    const now = new Date();
    const dtMap = {
      1: 1,   		// 1 天
      7: 7,   		// 1 週
      30: 30, 		// 1 月
      365: 365		// 1 年
    };
	
    if (dtAt in dtMap) {
      const daysAgo = dtMap[dtAt];
      dateFilter = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    }
	
	// Step 2: 組合查詢條件（模糊查詢 + 日期條件）
    const query = {};
	
    if (keyword.trim()) {
      query.productNameZh = { $regex: keyword.trim(), $options: 'i' };
    }

    if (dateFilter) {
      query.updateAt = { $gte: dateFilter };
    }
	// Step 3: 查詢資料
	const totalCount = await db.collection('products').countDocuments(query);
	
	// 查詢分頁商品
    const products = await db.collection('products')
      .find(query)
	  .sort({ client: 1, productCode: 1 }) // 排序依據
	  .skip(skip)
	  .limit(pageSize)
	  .toArray();
	  
	res.json({
	  products,
	  totalPages: Math.ceil(totalCount / pageSize),
	  currentPage: page
	});
	
  } catch (err) {
    res.status(500).json({ success: false, message: '伺服器錯誤，查詢商品分頁失敗' });
  }
});

app.post('/api/inventory/by-products', async (req, res) => {
  const { productCodes } = req.body;
  
  try {
	if (!Array.isArray(productCodes)) {
      return res.status(400).json({ error: '請提供 productCodes 陣列' });
	}
    const inventory = await db.collection('inventory')
      .find({ productCode: { $in: productCodes } })
      .toArray();
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ success: false, message: '伺服器錯誤，查詢商品資料失敗' });
  }
});