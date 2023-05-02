'use strict';
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [ 'query' ] });

/* GET home page. */
router.get('/', async (req, res, next) => {
  const title = '予定調整くん';
  if (req.user) {
    const schedules = await prisma.schedule.findMany({
      where: { createdBy: parseInt(req.user.id) },
      orderBy: { updatedAt: 'desc' }
    });
    res.render('index', {
      title: title,
      user: req.user,
      schedules: schedules
    });
  } else {
    res.render('index', { title: title, user: req.user });
  }
});

module.exports = router;
