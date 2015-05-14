/**
 * Accept an app object, and serve its views.
 */
var einstein = module.exports = function (app) {
  var chug = app.chug;

  chug.onceReady(function () {
    var views = app.views;

    // Iterate over the views building an array of key-value pair strings.
    var pairs = [];
    views.each(function (asset) {
      var compiled = asset.getCompiledContent();
      var minified = asset.getMinifiedContent();
      var key = compiled.key.replace(/"/g, '\\"');
      pairs.push(JSON.stringify(key) + ':' + minified.toString());
    });

    // If using Ltl, include escaping functions.
    var ltl = process.ltl;
    if (ltl) {
      pairs.push('$:' + ltl.$.toString());
      pairs.push('"&":' + ltl['&'].toString());
    }

    // TODO: Allow views to be separated into batches to reduce payload.
    var url = '/e.js';
    var asset = new chug.Asset(url);

    // Route the views with pre-zipping so clients can download them quickly.
    views.then(function () {
      var env = process.env.NODE_ENV || 'prod';
      var br = app.isDev ? '\n' : '';
      var tab = app.isDev ? '  ' : '';
      var code = 'Einstein({' + br + tab + pairs.join(',' + br + tab) + br + '});';
      asset.setContent(code);
      if (!app.isDev) {
        asset.minify();
      }
      asset.route();
      var colorUrl = url.cyan || url;
      var logInfo = (app.log || console).info;
      logInfo('[Einstein] Views routed to ' + colorUrl + '.');

      var mobile = new chug.Asset('/m.js');
      var script = 'window._isMobileApp=1;' + app.ui;
      if (app.href) {
        script = "window._href='" + app.href + "';" + script;
      }
      if (app.delay) {
        script = "window._delay='" + app.delay + "';" + script;
      }
      mobile.setContent(script + ';' + code).cull('build', 'app');
      if (!app.isDev) {
        mobile.wrap().minify();
      }
      mobile.write(process.cwd() + '/mobile/www/js', 'm.js', 'minified');
    });

  });
};

/**
 * Expose the Einstein version via package.json lazy loading.
 */
Object.defineProperty(einstein, 'version', {
  get: function () {
    return require(__dirname + '/package.json').version;
  }
});

/**
 * Expose the paths to Einstein's front-end scripts.
 */
einstein.jymin = __dirname + '/scripts/einstein-jymin.js';
einstein.client = __dirname + '/einstein-client.js';
einstein.clientMin = __dirname + '/einstein-client.min.js';
