'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [ 'query' ] });

router.get('/new', authenticationEnsurer, (req, res, next) => {
  res.render('new', { user: req.user });
});

router.post('/', authenticationEnsurer, async (req, res, next) => {
  const scheduleId = uuidv4();
  const updatedAt = new Date();
  const schedule = await prisma.schedule.create({
    data: {
      scheduleId: scheduleId,
      scheduleName: req.body.scheduleName.slice(0, 255) || '（名称未設定）',
      memo: req.body.memo,
      createdBy: parseInt(req.user.id),
      updatedAt: updatedAt
    }
  });
  const candidateNames = req.body.candidates.split('\n').map((s) => s.trim()).filter((s) => s !== '');
  const candidates = candidateNames.map((c) => ({
    candidateName: c,
    scheduleId: schedule.scheduleId
  }));
  await prisma.candidate.createMany({
    data: candidates
  })
  res.redirect('/schedules/' + schedule.scheduleId);
});

router.get('/:scheduleId', authenticationEnsurer, async (req, res, next) => {
  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: req.params.scheduleId },
    include: {
      user: {
        select: {
          userId: true,
          username: true
        }
      }
    }
  });
  if (schedule) {
    const candidates = await prisma.candidate.findMany({
      where: { scheduleId: schedule.scheduleId },
      orderBy: { candidateId: 'asc' }
    });
    // データベースからその予定の全ての出欠を取得する
    const availabilities = await prisma.availability.findMany({
      where: { scheduleId: schedule.scheduleId },
      orderBy: { candidateId: 'asc' },
      include: {
        user: {
          select: {
            userId: true,
            username: true
          }
        }
      }
    });
    // 出欠 MapMap を作成する
    const availabilityMapMap = new Map(); // key: userId, value: Map(key: candidateId, value: availability)
    availabilities.forEach((a) => {
      const map = availabilityMapMap.get(a.user.userId) || new Map();
      map.set(a.candidateId, a.availability);
      availabilityMapMap.set(a.user.userId, map);
    });

    // 閲覧ユーザと出欠に紐づくユーザからユーザ Map を作る
    const userMap = new Map(); // key: userId, value: User
    userMap.set(parseInt(req.user.id), {
        isSelf: true,
        userId: parseInt(req.user.id),
        username: req.user.username
    });
    availabilities.forEach((a) => {
      userMap.set(a.user.userId, {
        isSelf: parseInt(req.user.id) === a.user.userId, // 閲覧ユーザ自身であるかを示す真偽値
        userId: a.user.userId,
        username: a.user.username
      });
    });

    // 全ユーザ、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
    const users = Array.from(userMap.values());
    users.forEach((u) => {
      candidates.forEach((c) => {
        const map = availabilityMapMap.get(u.userId) || new Map();
        const a = map.get(c.candidateId) || 0; // デフォルト値は 0 を使用
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
  } else {
    const err = new Error('指定された予定は見つかりません');
    err.status = 404;
    next(err);
  }
});

module.exports = router;
