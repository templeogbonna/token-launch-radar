const DEXSCREENER_API = 'https://api.dexscreener.com';
const MAX_PROFILES = 30;

function numericValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (value === '') return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createdAtValue(value) {
  const timestamp = numericValue(value);
  return timestamp !== null && timestamp > 0 && timestamp <= Date.now()
    ? timestamp
    : null;
}

export function normalizeSolanaTokens(profiles, pairs) {
  const profilesByAddress = new Map();

  for (const profile of profiles) {
    if (
      profile?.chainId === 'solana' &&
      typeof profile.tokenAddress === 'string' &&
      profile.tokenAddress.length > 0
    ) {
      profilesByAddress.set(profile.tokenAddress.toLowerCase(), profile.tokenAddress);
    }
  }

  const pairsByAddress = new Map();
  for (const pair of pairs) {
    if (pair?.chainId !== 'solana') continue;

    for (const token of [pair.baseToken, pair.quoteToken]) {
      const address = token?.address?.toLowerCase();
      if (!address || !profilesByAddress.has(address)) continue;

      const matches = pairsByAddress.get(address) ?? [];
      matches.push({ pair, token });
      pairsByAddress.set(address, matches);
    }
  }

  return [...profilesByAddress.entries()]
    .map(([address, tokenAddress]) => {
      const matches = pairsByAddress.get(address);
      if (!matches?.length) return null;

      const mostLiquid = [...matches].sort((a, b) =>
        (numericValue(b.pair.liquidity?.usd) ?? -1) -
        (numericValue(a.pair.liquidity?.usd) ?? -1)
      )[0];
      const launchTimes = matches
        .map(({ pair }) => createdAtValue(pair.pairCreatedAt))
        .filter((timestamp) => timestamp !== null);

      return {
        address: tokenAddress,
        name: mostLiquid.token.name || null,
        symbol: mostLiquid.token.symbol || null,
        launchTime: launchTimes.length ? Math.min(...launchTimes) : null,
        liquidityUsd: numericValue(mostLiquid.pair.liquidity?.usd),
        marketCapUsd: numericValue(mostLiquid.pair.marketCap),
        volume24hUsd: numericValue(mostLiquid.pair.volume?.h24),
        dexScreenerUrl: `https://dexscreener.com/solana/${encodeURIComponent(tokenAddress)}`,
        solscanUrl: `https://solscan.io/token/${encodeURIComponent(tokenAddress)}`
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.launchTime ?? 0) - (a.launchTime ?? 0));
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`DexScreener returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('DexScreener returned an unexpected response');
  }
  return payload;
}

export async function fetchLatestSolanaTokens(fetchImpl = fetch) {
  const profiles = await fetchJson(
    `${DEXSCREENER_API}/token-profiles/latest/v1`,
    fetchImpl
  );
  const addresses = [
    ...new Set(
      profiles
        .filter(
          (profile) =>
            profile?.chainId === 'solana' &&
            typeof profile.tokenAddress === 'string' &&
            profile.tokenAddress.length > 0
        )
        .map((profile) => profile.tokenAddress)
    )
  ].slice(0, MAX_PROFILES);

  if (!addresses.length) return [];

  const pairs = await fetchJson(
    `${DEXSCREENER_API}/tokens/v1/solana/${addresses.map(encodeURIComponent).join(',')}`,
    fetchImpl
  );
  return normalizeSolanaTokens(profiles, pairs);
}
