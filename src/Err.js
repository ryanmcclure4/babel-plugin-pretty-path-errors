/**
 * Custom error type with function path
 */
function PrettyPathError(err, functionPath = '') {
  this.name = 'PrettyPathError';
  this.functionPath = functionPath;
  this.message = (err.message || '');
}

PrettyPathError.prototype = Error.prototype;
PrettyPathError.prototype.toString = function toString() {
  return this.message + ' | Location (' + this.functionPath + ')';
}

module.exports = PrettyPathError;
