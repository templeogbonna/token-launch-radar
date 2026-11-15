import express from 'express';
import dotenv from 'dotenv';
import { fetchLatestSolanaTokens } from './dexscreener.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/api/tokens', async (req, res) => {
  try {
    const tokens = await fetchLatestSolanaTokens();
    res.set('Cache-Control', 'no-store').json({
      tokens,
      source: 'DexScreener',
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Token discovery failed:', error);
    res.status(502).json({
      error: 'Token discovery is temporarily unavailable. Please try again shortly.'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    application: 'Solana Token Launch Radar',
    blockchain: 'Solana'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Token Radar running on port ${PORT}`);
});
