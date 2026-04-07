'use strict';
const http = require('http');
// v2.x exports the service function directly (no named createServer export)
const corsProxy = require('@isomorphic-git/cors-proxy');

const PORT = parseInt(process.env.PORT || '9999', 10);

// Restrict allowed origins in production by setting ALLOW_ORIGIN to your
// app's domain (e.g. https://linkml-editor.example.com). Defaults to '*'
// which is fine for local dev but should be tightened in production.
// The module reads process.env.ALLOW_ORIGIN directly.
const allowOrigin = process.env.ALLOW_ORIGIN || '*';

const server = http.createServer(corsProxy);

server.listen(PORT, () => {
  console.log(`[cors-proxy] listening on port ${PORT}`);
  if (allowOrigin === '*') {
    console.warn('[cors-proxy] ALLOW_ORIGIN is * — set it to your app domain in production');
  }
});
