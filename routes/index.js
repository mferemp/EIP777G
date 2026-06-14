const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'securegate-777g' });
});

router.use('/state', require('./state'));
router.use('/recovery', require('./recovery'));
router.use('/rescue', require('./rescue'));
router.use('/deploy', require('./deploy'));
router.use('/docs', require('./docs'));
router.use('/export', require('./export-build'));
router.use('/code', require('./code-bundle'));

module.exports = router;