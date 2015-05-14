/**
 * This file is used in conjunction with Jymin to form the Einstein client.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../einstein-client.js which includes required Jymin functions.
 *
 * @use jymin/jymin.js
 */

/**
 * Einstein is a function that accepts new views.
 */
var Einstein = window.Einstein = function (newViews) {

  var views = Einstein._views = {
    '$': function(v){return (!v&&v!==0?'':(typeof v=='object'?Jymin.stringify(v)||'':''+v)).replace(/</g,'&lt;');},
    '&': function(v){return Jymin.escape(!v&&v!==0?'':''+v);}
  };
  var cache = Einstein._cache = {};

  Jymin.forIn(newViews, function (name, view) {
    views[name] = view;
    Jymin.trigger(Einstein, name);
  });

  // Only get Einstein ready if we can and should.
  if (!history.pushState || Einstein._isReady) {
    return;
  }

  // When a same-domain link is clicked, fetch it via XMLHttpRequest.
  Jymin.on('a', 'click,touchend', function (a, event) {
    var href = Jymin.getAttribute(a, 'href');
    var url = removeHash(a.href);
    var buttonNumber = event.which;
    var isLeftClick = (!buttonNumber || (buttonNumber == 1));
    if (isLeftClick) {
      if (Jymin.startsWith(href, '#')) {
        var name = href.substr(1);
        Jymin.scrollToAnchor(name);
        Jymin.historyReplace(url + href);
        Jymin.preventDefault(event);
        Jymin.stopPropagation(event);
      }
      else if (url && isSameDomain(url)) {
        Jymin.preventDefault(event);
        loadUrl(url, 0, a);
      }
    }
  });

  // When a same-domain link is hovered, prefetch it.
  // TODO: Use mouse movement to detect probably targets.
  Jymin.on('a', 'mouseover,touchstart', function (a) {
    if (!Jymin.hasClass(a, '_noprefetch')) {
      var url = removeHash(a.href);
      var isDifferentPage = (url != removeHash(location));
      if (isDifferentPage && isSameDomain(url)) {
        prefetchUrl(url);
      }
    }
  });

  // When a form field changes, timestamp the form.
  Jymin.on('input,select,textarea', 'change', function (input) {
    (input.form || 0)._lastChanged = Jymin.getTime();
  });

  // When a form button is clicked, attach it to the form.
  Jymin.on('input,button', 'click,touchend', function (button) {
    if (button.type == 'submit') {
      var form = button.form;
      if (form) {
        if (form._clickedButton != button) {
          form._clickedButton = button;
          form._lastChanged = Jymin.getTime();
        }
      }
    }
  });

  // When a form is submitted, gather its data and submit via XMLHttpRequest.
  Jymin.on('form', 'submit', function (form, event) {
    var url = removeHash(form.action || removeQuery(location));
    var enc = Jymin.getAttribute(form, 'enctype');
    var isGet = (Jymin.lower(form.method) == 'get');
    if (isSameDomain(url) && !/multipart/.test(enc)) {
      Jymin.preventDefault(event);

      var isValid = form._validate ? form._validate() : true;
      if (!isValid) {
        return;
      }

      // Get form data.
      var data = [];
      Jymin.all(form, 'input,select,textarea,button', function (input) {
        var name = input.name;
        var type = input.type;
        var value = Jymin.getValue(input);
        var ignore = !name;
        ignore = ignore || ((type == 'radio') && !value);
        ignore = ignore || ((type == 'submit') && (input != form._clickedButton));
        if (!ignore) {
          var pushFormValue = function (value) {
            Jymin.push(data, Jymin.escape(name) + '=' + Jymin.escape(value));
          };
          if (Jymin.isString(value)) {
            pushFormValue(value);
          }
          else {
            Jymin.forEach(value, pushFormValue);
          }
        }
      });
      url = appendData(url, 'v=' + Jymin.getTime());

      // For a get request, append data to the URL.
      if (isGet) {
        url = appendData(data.join('&'));
        data = 0;
      }
      // If posting, append a timestamp so we can repost with this base URL.
      else {
        url = appendExtension(url);
        data = data.join('&');
      }

      // Submit form data to the URL.
      loadUrl(url, data, form);
    }
  });

  // When a user presses the back button, render the new URL.
  Jymin.onHistoryPop(function () {
    if (location != loadingUrl) {
      loadUrl(location);
    }
  });

  var loadingUrl;

  var isSameDomain = function (url) {
    return Jymin.startsWith(url, location.protocol + '//' + location.host + '/');
  };

  var removeHash = function (url) {
    return Jymin.ensureString(url).split('#')[0];
  };

  var removeQuery = function (url) {
    return Jymin.ensureString(url).split('?')[0];
  };

  var appendExtension = function (url) {
    return removeExtension(url).replace(/(\?|$)/, '.json$1');
  };

  var appendData = function (url, data) {
    return Jymin.ensureString(url) +
      (url.indexOf('?') > -1 ? '&' : '?') +
      data;
  };

  var removeExtension = function (url) {
    return Jymin.ensureString(url).replace(/\.json/g, '');
  };

  var removeCacheBust = function (url) {
    return url.replace(/(\?v=\d+$|&v=\d+)/, '');
  };

  var prefetchUrl = function (url) {
    // Only proceed if it's not already prefetched.
    if (!cache[url]) {
      //+env:debug
      Jymin.log('[Einstein] Prefetching "' + url + '".');
      //-env:debug

      // Create a callback queue to execute when data arrives.
      cache[url] = [function (response) {
        //+env:debug
        Jymin.log('[Einstein] Caching contents for prefetched URL "' + url + '".');
        //-env:debug

        // Cache the response so data can be used without a queue.
        cache[url] = response;

        // Remove the data after 10 seconds, or the given TTL.
        var ttl = response.ttl || 1e4;
        setTimeout(function () {
          // Only delete if it's not a new callback queue.
          if (!Jymin.isArray(cache[url])) {
            //+env:debug
            Jymin.log('[Einstein] Removing "' + url + '" from prefetch cache.');
            //-env:debug
            delete cache[url];
          }
        }, ttl);
      }];
      getEinsteinJson(url);
    }
  };

  /**
   * Load a URL via GET request.
   */
  var loadUrl = Einstein._load = function (url, data, sourceElement) {
    loadingUrl = removeExtension(url);
    var targetSelector, targetView;

    // If the URL is being loaded for a link or form, paint the target.
    if (sourceElement) {
      targetSelector = Jymin.getData(sourceElement, '_einsteinTarget');
      targetView = Jymin.getData(sourceElement, '_einsteinView');
      if (targetSelector) {
        Jymin.all(targetSelector, function (element) {
          Jymin.addClass(element, '_einsteinTarget');
        });
      }
    }

    //+env:debug
    Jymin.log('[Einstein] Loading "' + url + '".');
    //-env:debug

    // Set all spinners in the page to their loading state.
    console.log('SPIN!');
    Jymin.all('._spinner', function (spinner) {
      console.log('LOAD!', spinner);
      Jymin.addClass(spinner, '_loading');
    });

    var handler = function (state, url) {
      renderResponse(targetView, state, state, targetSelector, url);
    };

    // A resource is either a cached response, a callback queue, or nothing.
    var resource = cache[url];

    // If there's no resource, start the JSON request.
    if (!resource) {
      //+env:debug
      Jymin.log('[Einstein] Creating callback queue for "' + url + '".');
      //-env:debug
      cache[url] = [handler];
      getEinsteinJson(url, data);
    }
    // If the "resource" is a callback queue, then pushing means listening.
    else if (Jymin.isArray(resource)) {
      //+env:debug
      Jymin.log('[Einstein] Queueing callback for "' + url + '".');
      //-env:debug
      Jymin.push(resource, handler);
    }
    // If the resource exists and isn't an array, render it.
    else {
      //+env:debug
      Jymin.log('[Einstein] Found precached response for "' + url + '".');
      //-env:debug
      handler(resource, url);
    }
  };

  /**
   * Request JSON, then execute any callbacks that have been waiting for it.
   */
  var getEinsteinJson = function (url, data) {
    //+env:debug
    Jymin.log('[Einstein] Fetching response for "' + url + '".');
    //-env:debug

    // Indicate with a URL param that Einstein is requesting data, so we'll get JSON.
    var jsonUrl = appendExtension(url);

    // When data is received, cache the response and execute callbacks.
    var onComplete = function (data) {
      var queue = cache[url];
      cache[url] = data;
      //+env:debug
      Jymin.log('[Einstein] Running ' + queue.length + ' callback(s) for "' + url + '".');
      //-env:debug
      Jymin.forEach(queue, function (callback) {
        callback(data, url);
      });
    };

    jsonUrl = jsonUrl.replace(/^file:\/\//, window._href);

    // Fire the JSON request.
    Jymin.getResponse(jsonUrl, data, onComplete, onComplete);
  };

  // Render a template with the given state, and display the resulting HTML.
  var renderResponse = Einstein._render = function (targetView, state, scope, targetSelector, requestUrl) {
    Einstein._state = state = state || {};
    scope = scope || state;
    var responseUrl = removeExtension(state.url || requestUrl);
    var viewName = Einstein._viewName = targetView || state.view || 'error0';
    var view = Einstein._view = views[viewName];
    var html;
    requestUrl = removeExtension(requestUrl);
    loadingUrl = '' + loadingUrl;

    // Make sure the URL we render is the last one we tried to load.
    console.log(requestUrl, loadingUrl);
    if (requestUrl == loadingUrl) {

      // Reset any spinners.
      Jymin.all('._spinner,._einsteinTarget', function (spinner) {
        Jymin.removeClass(spinner, '_loading');
      });

      // If we received HTML, try rendering it.
      if (Jymin.trim(state)[0] == '<') {
        html = state;
        //+env:debug
        Jymin.log('[Einstein] Rendering HTML string');
        //-env:debug
      }

      // If the state refers to a view that we have, render it.
      else if (view) {
        html = view.call(views, state, scope);
        //+env:debug
        Jymin.log('[Einstein] Rendering view "' + viewName + '".');
        //-env:debug
      }

      // If we can't find a corresponding view, navigate the old-fashioned way.
      else {
        //+env:debug
        Jymin.error('[Einstein] View "' + viewName + '" not found. Changing location.');
        //-env:debug
        window.location = responseUrl;
        return;
      }
    }

    // If there's HTML to render, show it as a page.
    if (html) {
      Jymin.pushHtml(html, targetSelector);

      // Trigger a made-up event to allow code to execute when a new page renders.
      Jymin.trigger(Einstein, 'render', responseUrl);

      // Change the location bar to reflect where we are now.
      if (!Einstein._isMobileApp) {
        var isSamePage = removeQuery(responseUrl) == removeQuery(location.href);
        var historyMethod = isSamePage ? Jymin.historyReplace : Jymin.historyPush;
        historyMethod(removeCacheBust(responseUrl));
      }

      // If we render this page again, we'll want fresh data.
      delete cache[requestUrl];
    }
  };

  Einstein._update = function (properties) {
    var state = Einstein._state = Einstein._state || {};
    Jymin.forIn(properties, function (key, value) {
      state[key] = value;
    });
    loadingUrl = location.href;
    Einstein._render(Einstein._viewName, state, state, 0, loadingUrl);
  };

  // Trigger the "ready" event on the Einstein object.
  Jymin.ready(Einstein);
};

/**
 * Insert a script to load views.
 */
Jymin.insertScript((window._href || '') + '/e.js?v=CACHE_BUST');
