import { walletMiddleware } from '../server/wallet.mjs';
export default function handler(req, res) {
  req.url = '/api/wallet';
  return walletMiddleware(process.env)(req, res);
}
