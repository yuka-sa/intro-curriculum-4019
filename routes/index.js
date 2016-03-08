'use strict';
let express = require('express');
let router = express.Router();
let Schedule = require('../models/schedule');

/* GET home page. */
router.get('/', (req, res, next) => {
  let title = '予定調整くん';
  if (req.user) {
    Schedule.findAll({
      where: {
        createdBy: req.user.id
      },
      order: '"updatedAt" DESC'
    }).then((schedules) => {
      res.render('index', {
        title: title,
        user: req.user,
        schedules: schedules
      });
    });
  } else {
    res.render('index', { title: title, user: req.user });
  }
});

module.exports = router;
