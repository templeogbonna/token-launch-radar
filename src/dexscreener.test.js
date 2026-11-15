import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLatestSolanaTokens, normalizeSolanaTokens } from './dexscreener.js';

const address = 'TokenAddress';

test('normalizes confirmed Solana pairs and leaves missing market data unavailable', () => {
  const now = Date.now();
  const tokens = normalizeSolanaTokens(
    [
      { chainId: 'solana', tokenAddress: address },
      { chainId: 'ethereum', tokenAddress: 'other-chain-token' },
      { chainId: 'solana', tokenAddress: 'no-pair-token' }
    ],
    [
      {
        chainId: 'solana',
        pairCreatedAt: now - 60_000,
        baseToken: { address, name: 'Verified name', symbol: 'VER' },
        quoteToken: { address: 'quote' },
        liquidity: { usd: 20 },
        marketCap: 900,
        volume: { h24: 70 }
      },
      {
        chainId: 'solana',
        pairCreatedAt: now - 120_000,
        baseToken: { address, name: 'Verified name', symbol: 'VER' },
        quoteToken: { address: 'other-quote' },
        liquidity: { usd: 100 },
        fdv: 50_000,
        volume: { h24: 80 }
      },
      {
        chainId: 'ethereum',
        baseToken: { address: 'other-chain-token' }
      }
    ]
  );

  assert.equal(tokens.length, 1);
  assert.deepEqual(tokens[0], {
    address,
    name: 'Verified name',
    symbol: 'VER',
    launchTime: now - 120_000,
    liquidityUsd: 100,
    marketCapUsd: null,
    volume24hUsd: 80,
    dexScreenerUrl: `https://dexscreener.com/solana/${address}`,
    solscanUrl: `https://solscan.io/token/${address}`
  });
});

test('uses the latest profiles feed and batches only Solana addresses for pair data', async () => {
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(url);
    const payload = requestedUrls.length === 1
      ? [
          { chainId: 'solana', tokenAddress: address },
          { chainId: 'ethereum', tokenAddress: 'other-chain-token' }
        ]
      : [{
          chainId: 'solana',
          pairCreatedAt: Date.now() - 10_000,
          baseToken: { address, name: 'API Token', symbol: 'API' },
          quoteToken: { address: 'quote' },
          liquidity: { usd: 15 },
          marketCap: 30,
          volume: { h24: 2 }
        }];

    return { ok: true, json: async () => payload };
  };

  const tokens = await fetchLatestSolanaTokens(fetchImpl);

  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /token-profiles\/latest\/v1$/);
  assert.match(requestedUrls[1], new RegExp(`/tokens/v1/solana/${address}$`));
  assert.equal(tokens[0].name, 'API Token');
});

test('fails explicitly when the discovery provider responds with an error', async () => {
  await assert.rejects(
    fetchLatestSolanaTokens(async () => ({ ok: false, status: 503 })),
    /DexScreener returned HTTP 503/
  );
});
