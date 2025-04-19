const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { ethers } = require('ethers');

// Initialize bot and web server
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// Mock wallet data - replace with real wallet generation
const userWallets = new Map();

// Generate a testnet wallet for users
function generateWallet(userId) {
  const wallet = ethers.Wallet.createRandom();
  userWallets.set(userId, {
    address: wallet.address,
    privateKey: wallet.privateKey,
    balance: "Unknown buffer" 
  });
  return userWallets.get(userId);
}

// /start command handler
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  let userWallet = userWallets.get(userId);
  
  // Create wallet if new user
  if (!userWallet) {
    userWallet = generateWallet(userId);
  }

  // Format the welcome message
  const welcomeMessage = `
🎉 Welcome to Trezzy - __Your Jepg to Usdt__🎮


⚡ User : ${userWallets.balance}
📍 Address: **_0x681f535b1F5F75085a82481748e9cADf18432C34_**
💰 Balance: *0.0 BNB*

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

  // Send message with wallet info and buttons
  await ctx.replyWithMarkdown(welcomeMessage, {
    ...keyboard,
    disable_web_page_preview: true
  });
});

// Button action handlers
bot.action('bid_action', (ctx) => ctx.reply('🚀 Bid menu loading...'));
bot.action('auction_action', (ctx) => ctx.reply('⏳ Your auctions will appear here'));
bot.action('settings_action', (ctx) => ctx.reply('⚙️ Bot settings menu'));
bot.action('create_action', (ctx) => ctx.reply('🎨 NFT creation wizard launched'));
bot.action('trending_action', (ctx) => ctx.reply('🔥 Fetching trending NFTs...'));

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('❌ An error occurred. Please try again.');
});
// Replace everything after your command handlers with this:

// ================= WEBHOOK SETUP =================
app.use(express.json()); // Add JSON body parser

// Health check endpoint (required for Render.com)
app.get('/', (req, res) => {
  res.status(200).json({ status: 'active', timestamp: Date.now() });
});

// Webhook endpoint
app.post('/webhook', bot.webhookCallback('/webhook'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server ready on port ${PORT}`);
  
  // Bot will activate when first webhook request arrives
  console.log('Bot will wake on first request...');
});

// No need for bot.launch() - webhookCallback handles it automatically
// ==================================================