const { randomUUID } = require('crypto');

function uuid() {
  return randomUUID().replace(/-/g, '');
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { uuid, asyncHandler };
