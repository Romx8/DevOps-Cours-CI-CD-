const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  res.status(500).json({ error: 'Incident simulé : endpoint products hors service' });
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, price_cents, stock FROM products WHERE id = $1',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: 'Impossible de récupérer le produit',
      message: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, price_cents, stock } = req.body;

    if (!name || !description || !price_cents) {
      return res.status(400).json({
        error: 'name, description et price_cents sont obligatoires'
      });
    }

    const result = await pool.query(
      `INSERT INTO products (name, description, price_cents, stock)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, price_cents, stock`,
      [name, description, price_cents, stock || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: 'Impossible de créer le produit',
      message: error.message
    });
  }
});

module.exports = router;
