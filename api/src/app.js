const express = require('express');
const cors = require('cors');
const pool = require('./db');
const productsRouter = require('./routes/products');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur TrainShop Starter',
    endpoints: ['/health', '/products']
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      status: 'ok',
      service: 'trainshop-api',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'trainshop-api',
      database: 'unavailable',
      message: error.message
    });
  }
});

app.use('/products', productsRouter);

module.exports = app;
