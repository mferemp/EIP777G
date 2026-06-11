const express = require('express');
const router = express.Router();
const gate = require('../gate');

router.get('/', async (req, res) => {
  try {
    const state = await gate.readState();
    res.json(state);
  } catch (err) {
    console.error('GET /api/state (routes/state) error', err);
    res.status(500).json({ error: 'state_error', message: err.message });
  }
});

module.exports = router;
