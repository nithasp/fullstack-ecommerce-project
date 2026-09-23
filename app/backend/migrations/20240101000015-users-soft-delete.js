'use strict';

var fs = require('fs');
var path = require('path');

var dbm;
var Promise;

exports.setup = function (options) {
  dbm = options.dbmigrate;
  Promise = options.Promise;
};

exports.up = function (db) {
  return runSqlFile(db, '20240101000015-users-soft-delete-up.sql');
};

exports.down = function (db) {
  return runSqlFile(db, '20240101000015-users-soft-delete-down.sql');
};

function runSqlFile(db, file) {
  var filePath = path.join(__dirname, 'sqls', file);
  return new Promise(function (resolve, reject) {
    fs.readFile(filePath, { encoding: 'utf-8' }, function (err, data) {
      if (err) return reject(err);
      resolve(data);
    });
  }).then(function (data) {
    return db.runSql(data);
  });
}

exports._meta = {
  version: 1
};
