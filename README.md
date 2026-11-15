# Solana Token Launch Radar

A responsive Solana token launch dashboard powered by the public DexScreener API.

## Run

```sh
npm install
npm start
```

The Express server serves the dashboard and the `/api/tokens` endpoint. Set `PORT` in the environment to change the default port (`3000`).

The radar checks DexScreener's latest token profiles every 30 seconds and requests Solana pair data for those addresses. DexScreener's public endpoints do not require an API key, so none is stored in the browser or required in the environment. Token names, symbols, pair creation times, liquidity, market cap, and volume are only displayed when returned by the provider; unavailable values are not estimated.

Run the test suite with `npm test`.
