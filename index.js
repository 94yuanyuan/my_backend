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
  const { page = 1, pageSize = 5, keyword = '', dtAt = 0 } = req.body;
  try {
    const skip = (page - 1) * pageSize;

    // 日期條件處理
    const dtMap = { 1: 1, 7: 7, 30: 30, 365: 365 };
    let dateFilter = null;
    if (dtAt in dtMap) {
      dateFilter = new Date(Date.now() - dtMap[dtAt] * 24 * 60 * 60 * 1000);
    }

    // 查詢條件組合
    const query = {};
    if (keyword.trim()) {
      query.productNameZh = { $regex: keyword.trim(), $options: 'i' };
    }
    if (dateFilter) {
      query.updateAt = { $gte: dateFilter };
    }

    const totalCount = await db.collection('products').countDocuments(query);

    // 主要 aggregate 查詢
    const products = await db.collection('products').aggregate([
      { $match: query },
      { $sort: { client: 1, productCode: 1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $lookup: {
          from: 'inventory',
          localField: 'productCode',
          foreignField: 'productCode',
          as: 'inventory'
        }
      },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorCode',
          foreignField: 'vendorCode',
          as: 'vendor'
        }
      },
      {
        $addFields: {
          vendorName: { $arrayElemAt: ['$vendor.vendorName', 0] },
          stockByWarehouse: {
            $map: {
              input: '$inventory',
              as: 'inv',
              in: { warehouse: '$$inv.warehouse', quantity: '$$inv.quantity' }
            }
          },
          totalStock: { $sum: '$inventory.quantity' }
        }
      },
      {
        $project: {
          vendor: 0,
          inventory: 0 // 避免回傳多餘欄位
        }
      }
    ]).toArray();

    res.json({
      products,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '查詢商品資料失敗' });
  }
});