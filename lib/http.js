var http = require('http');

/**
 * Append the Einstein count to the redirect.
 */
http.ServerResponse.prototype.redirect = function (location) {
  var res = this;
  // If this is an XMLHttpRequest from Einstein, indicate it in the redirect URL.
  if (res.request.query.einstein) {
    location += (location.indexOf('?') < 0 ? '?' : '&') + 'einstein=r';
  }
  res.statusCode = 302;
  res.setHeader('location', location);
  res.end();
};
