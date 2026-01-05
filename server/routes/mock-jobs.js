const express = require('express');
const router = express.Router();

const { jobs } = require('../data/mockJobs');

// GET /api/mock-jobs
router.get('/', (req, res) => {
  res.json(jobs);
});

module.exports = router;
