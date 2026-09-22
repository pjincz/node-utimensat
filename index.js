'use strict';

const native = require('./build/Release/utimensat.node');
const { getSystemErrorName } = require('node:util');
const { isDate } = require('node:util/types');

function timestamp(value, name) {
  if (value === undefined || value === null) return null;
  let sec, nsec;
  if (isDate(value)) {
    const milliseconds = Date.prototype.getTime.call(value);
    if (!Number.isFinite(milliseconds)) {
      throw new RangeError(`${name} must be a valid Date`);
    }
    sec = Math.floor(milliseconds / 1000);
    nsec = (milliseconds - sec * 1000) * 1e6;
  } else if (typeof value === 'number') {
    sec = Math.floor(value);
    nsec = Math.round((value - sec) * 1e9);
    if (nsec === 1e9) {
      sec += 1;
      nsec = 0;
    }
  } else if (Array.isArray(value) && value.length === 2) {
    [sec, nsec] = value;
    if (typeof sec !== 'number' || typeof nsec !== 'number') {
      throw new TypeError(`${name} must contain numbers`);
    }
  } else {
    throw new TypeError(`${name} must be a number, Date, [tv_sec, tv_nsec], null or undefined`);
  }
  if (!Number.isSafeInteger(sec)) {
    throw new RangeError(`${name} seconds must be a safe integer`);
  }
  if (!Number.isInteger(nsec) || nsec < 0 || nsec > 999999999) {
    throw new RangeError(`${name} nanoseconds must be an integer between 0 and 999999999`);
  }
  return [sec, nsec];
}

function setTimes(path, atime, utime, nofollow) {
  if (typeof path !== 'string') {
    throw new TypeError('path must be a string');
  }
  if (path.includes('\0')) {
    throw new TypeError('path must not contain null bytes');
  }
  const errno = native(path, timestamp(atime, 'atime'), timestamp(utime, 'utime'), nofollow);
  if (errno !== 0) {
    const syscall = nofollow ? 'lutimensat' : 'utimensat';
    const code = getSystemErrorName(-errno);
    const error = new Error(`${code}: ${syscall} '${path}'`);
    Object.assign(error, { code, errno: -errno, syscall, path });
    throw error;
  }
}

/** Set atime and mtime independently, following symlinks. */
function utimensat(path, atime, utime) {
  return setTimes(path, atime, utime, false);
}

/** Set atime and mtime on the symbolic link itself. */
function lutimensat(path, atime, utime) {
  return setTimes(path, atime, utime, true);
}

module.exports = utimensat;
module.exports.utimensat = utimensat;
module.exports.lutimensat = lutimensat;
