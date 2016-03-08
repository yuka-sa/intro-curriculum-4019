'use strict';
let express = require('express');
let router = express.Router();
let authenticationEnsurer = require('./authendication-ensurer');
let uuid = require('node-uuid');
let Schedule = require('../models/schedule');
let Candidate = require('../models/candidate');
let User = require('../models/user');
let Availability = require('../models/availability');

router.get('/new', authenticationEnsurer, (req, res, next) => {
  res.render('new', { user: req.user });
});

router.post('/', authenticationEnsurer, (req, res, next) => {
  let scheduleId = uuid.v4();
  let updatedAt = new Date();
  Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255),
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  }).then((schedule) => {
    let candidateNames = req.body.candidates.trim().split('\n').map((s) => s.trim());
    let candidates = candidateNames.map((c) => { return {
      candidateName: c,
      scheduleId: schedule.scheduleId
    };});
    Candidate.bulkCreate(candidates).then(() => {
          res.redirect('/schedules/' + schedule.scheduleId);
    });
  });
});

router.get('/:scheduleId', authenticationEnsurer, (req, res, next) => {
  Schedule.findOne({
    include: [
      {
        model: User,
        attributes: ['userId', 'username']
      }],
    where: {
      scheduleId: req.params.scheduleId
    },
    order: '"updatedAt" DESC'
  }).then((schedule) => {
    if (schedule) {
      Candidate.findAll({
        where: { scheduleId: schedule.scheduleId },
        order: '"candidateId" ASC'
      }).then((candidates) => {
        // データベースからその予定の全ての出欠を取得する
        Availability.findAll({
          include: [
            {
              model: User,
              attributes: ['userId', 'username']
            }
          ],
          where: { scheduleId: schedule.scheduleId },
          order: '"user.username" ASC, "candidateId" ASC'
        }).then((availabilities) => {
          // 出欠 MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠)) を作成する
          let availabilityMapMap = new Map(); // key: userId, value: Map(key: candidateId, availability)
          availabilities.forEach((a) => {
            let map = availabilityMapMap.get(a.user.userId);
            map = map ? map : new Map();
            map.set(a.candidate.candidateId, a.availability);
            availabilityMapMap.set(a.user.userId, map);
          });

          // 閲覧ユーザーと出欠に紐づくユーザーからユーザー Map (キー:ユーザー ID, 値:ユーザー) を作る
          let userMap = new Map(); // key: userId, value: User
          userMap.set(req.user.id, {
              isSelf: true,
              userId: req.user.id,
              username: req.user.username
          });
          availabilities.forEach((a) => {
            userMap.set(a.user.userId, {
              isSelf: req.user.id === a.user.userId, // 閲覧ユーザー自身であるかを含める
              userId: a.user.userId,
              username: a.user.username
            });
          });

          // 全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
          let users = Array.from(userMap).map((keyValue) => keyValue[1]);
          users.forEach((u) => {
            candidates.forEach((c) => {
              let map = availabilityMapMap.get(u.userId);
              map = map ? map : new Map();
              let a = map.get(c.candidateId);
              a = a ? a : 0; // デフォルト値は 0 を利用
              map.set(c.candidateId, a);
              availabilityMapMap.set(u.userId, map);
            });
          });

          res.render('schedule', {
            user: req.user,
            schedule: schedule,
            candidates: candidates,
            users: users,
            availabilityMapMap: availabilityMapMap
          });
        });
      });
    } else {
      let err = new Error('指定された予定は見つかりません');
      err.status = 404;
      next(err);
    }
  });
});
module.exports = router;