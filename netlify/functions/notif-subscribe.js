const { wrap } = require('./_adapter');
const push = require('../../api/_push.js');
const inner = wrap(require('../../api/notif-subscribe.js'));

exports.handler = async (event) => {
    if (event.isBase64Encoded && event.body) {
        event.body = Buffer.from(event.body, 'base64').toString('utf8');
        event.isBase64Encoded = false;
    }
    await push.connect(event);
    return inner(event);
};
