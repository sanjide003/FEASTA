/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "8203c7d04187d6b9df87849e5433b2f0"
  }, {
    "url": "pwa-512x512.png",
    "revision": "b3ce26d53ef6babe13f555ee705b597e"
  }, {
    "url": "pwa-192x192.png",
    "revision": "40296ca3f7d16994e1536267cb2fbf68"
  }, {
    "url": "index.html",
    "revision": "c97cbc4de79add535f00088a73ec77e3"
  }, {
    "url": "icon.svg",
    "revision": "9989cd2dab7f562eaa5dcb8bfd9a4dd9"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "60e3e6d9b50c4fc8fa19ddfdd3e4797c"
  }, {
    "url": "assets/xlsx-zHa97828.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/web-aVJ0cWYX.js",
    "revision": null
  }, {
    "url": "assets/users-BTRkYR8K.js",
    "revision": null
  }, {
    "url": "assets/trash-aPRV0OCD.js",
    "revision": null
  }, {
    "url": "assets/save-BIofEq9M.js",
    "revision": null
  }, {
    "url": "assets/router-BijJOV8r.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-WkwZ5CU-.js",
    "revision": null
  }, {
    "url": "assets/plus-Ds2Fz237.js",
    "revision": null
  }, {
    "url": "assets/index-D7p6zcS1.css",
    "revision": null
  }, {
    "url": "assets/index-C3FqMzAp.js",
    "revision": null
  }, {
    "url": "assets/firebase-DTiTwFtf.js",
    "revision": null
  }, {
    "url": "assets/dist-BD91r3g6.js",
    "revision": null
  }, {
    "url": "assets/clipboard-check-CfoAvQQk.js",
    "revision": null
  }, {
    "url": "assets/WorkspaceShell-CcTeXovo.js",
    "revision": null
  }, {
    "url": "assets/TvControlPage-DC4oF9Wi.js",
    "revision": null
  }, {
    "url": "assets/TeamPortal-ZN5YOOu7.js",
    "revision": null
  }, {
    "url": "assets/JudgePortal-CgNjq8qz.js",
    "revision": null
  }, {
    "url": "assets/AdminPortal-D1lxnJMi.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "60e3e6d9b50c4fc8fa19ddfdd3e4797c"
  }, {
    "url": "icon.svg",
    "revision": "9989cd2dab7f562eaa5dcb8bfd9a4dd9"
  }, {
    "url": "pwa-192x192.png",
    "revision": "40296ca3f7d16994e1536267cb2fbf68"
  }, {
    "url": "pwa-512x512.png",
    "revision": "b3ce26d53ef6babe13f555ee705b597e"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "8203c7d04187d6b9df87849e5433b2f0"
  }, {
    "url": "manifest.webmanifest",
    "revision": "fb1185eed25ade3a2db1d5b37685e7ac"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/firebase-runtime-config\.js$/]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/cdnjs\.cloudflare\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "cdn-assets-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
