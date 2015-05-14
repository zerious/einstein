// @use ../scripts/einstein-jymin.js

/**
 * Add Google Analytics script-loading code to the page.
 */
window.GoogleAnalyticsObject = 'ga';
var ga = window.ga = function () {
  ga.q.push(arguments)
};
ga.l = Jymin.getTime();
ga.q = [
  ['create', 'GOOGLE_ANALYTICS_ID', 'GOOGLE_ANALYTICS_SITE'],
  ['send', 'pageview']
];
Jymin.insertScript('//www.google-analytics.com/analytics.js');

/**
 * When a new page is rendered, record a pageview.
 */
Jymin.bind(Einstein, 'render', function () {
  ga('send', 'pageview');
});
