const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');

// Initialize bot and web server
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// Wallet server configuration
const WALLET_SERVER_URL = process.env.SERVER || 'http://localhost:3000';

// Function to get or create wallet from external server
async function getUserWallet(userId) {
  try {
    const response = await axios.post(`${WALLET_SERVER_URL}/get-wallet`, {
      userId: userId.toString()
    });
    return response.data;
  } catch (error) {
    console.error('Wallet server error:', error);
    return null;
  }
}
// /start command handler
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  // Get wallet from external server
  const wallet = await getUserWallet(userId);

  if (!wallet) {
    return ctx.reply('❌ Failed to load wallet. Please try again later.');
  }

  // Format the welcome message (this will be the photo caption)
  const welcomeMessage = `
🎉 Welcome to Trezzy - __Your Jepg to Usdt__🎮

⚡ User: ${userId}
📍 Address: \`${wallet.address}\`
💰 Balance: *${wallet.balance} BNB*

✨ What you can do:
- 🛍️ Buy/Sell NFTs instantly
- 🏷️ Create & auction your NFTs
- 🔥 Discover trending collections
- 💰 Earn from trading fees

__Use the buttons below to get started!__

*(Inspired by @Unknown_WebG)*
  `;

  // Create inline keyboard
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔼 Bid', 'bid_action')],
    [Markup.button.callback('🏷️ Auction', 'auction_action'), 
     Markup.button.callback('⚙️ Settings', 'settings_action')],
    [Markup.button.callback('🛠️ Create NFT', 'create_action'),
     Markup.button.callback('📈 Trending', 'trending_action')]
  ]);

  await ctx.replyWithPhoto(
    Input.fromLocalFile('.image.jpg'), // Local file path
    {
      caption: welcomeMessage,
      parse_mode: 'Markdown',
      ...keyboard,
    }
  );
});
// ... [keep all your existing button action handlers] ...

// ================= WEBHOOK SETUP =================
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'active',
    service: 'Trezzy NFT Bot',
    timestamp: Date.now() 
  });
});

// Webhook endpoint
app.post('/webhook', bot.webhookCallback('/webhook'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`Wallet server: ${WALLET_SERVER_URL}`);
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});