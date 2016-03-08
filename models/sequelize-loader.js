'use strict';
let Sequelize = require('sequelize');
let sequelize = new Sequelize(
  'postgres://postgres:postgres@localhost/schedule_arranger',
  { logging: true });

module.exports = {
  database: sequelize,
  Sequelize: Sequelize
};