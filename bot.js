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
    balance: '0.0'
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
**📈 TREAZY – JPG 💱 USD**  
*"Your JPEGs just got a utility upgrade."*  

💳 **Wallet:** /......./ | 💸 **Liquidity:**/....../

🔥 **Perks:**  
• **Instant liquidity** – Sell NFTs in 1 click, no waiting.  
• **Stake & earn** – Lock NFTs to generate passive income.  
• **Whale watch** – Track big buys before they trend.  
• **Fee-sharing** – Get 10% back on every trade.  

📌 **Drop a contract. Let’s make your wallet smile.**  

*(Inspired by @Unkn.)*
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

// Set up Express web server
app.use(bot.webhookCallback('/webhook'));
app.post('/webhook', (req, res) => res.sendStatus(200));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  bot.launch().then(() => console.log('Bot started'));
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));