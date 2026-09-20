import { pushHandler } from '../../server/push.mjs';
export default function handler(req, res) { return pushHandler(req, res); }
