const { wrap } = require('./_adapter');
const handler = require('../../lib/ytplay-node.js');

exports.handler = wrap(handler);
