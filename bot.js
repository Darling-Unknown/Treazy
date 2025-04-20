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
//

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const wallet = await getUserWallet(userId);

  if (!wallet) {
    return ctx.reply('❌ Failed to load wallet. Please try again later.');
  }

  const welcomeMessage = `
🎉 *Welcome to Trezzy - __Your Jepg to Usdt__* 🎮

⚡ *User:* \`${userId}\`
📍 *Address:* \`${wallet.address}\`
💰 *Balance:* *${wallet.balance} BNB*

✨ *What you can do:*
- 🛍️ Trade NFTs instantly
- 🏷️ Create & auction your NFTs
- 🔥 Discover trending collections
- 💰 Earn from trading fees

__Use the buttons below to get started!__

*(Inspired by @Unknown_WebG)*
  `;

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔼 Bid', 'bid_action')],
    [
      Markup.button.callback('🏷️ Auction', 'auction_action'),
      Markup.button.callback('⚙️ Settings', 'settings_action')
    ],
    [
      Markup.button.callback('🛠️ Create NFT', 'create_action'),
      Markup.button.callback('📈 Trending', 'trending_action')
    ]
  ]);

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard.reply_markup,
    disable_web_page_preview: true
  });
});
// Add this near your other action handlers
bot.action('settings_action', async (ctx) => {
  // Create settings menu with two buttons
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔑 Private Key', 'get_private_key')],
    [Markup.button.callback('⚙️ Other Settings', 'other_settings')],
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  await ctx.editMessageText('⚙️ Settings Panel\n\n💰 Fee Status: *10% discount active (referred user)*\n🔥 **Burn Nfts Created and Reclaim Your Bnb 🤙**\n\n📌 Trading Preferences:\n- 🔴🟢 Confirm Trades:  *(Green=Instant, Red=Confirm)*\n\n🔘 Quick Actions:\n\n-click below-',
    {
      parse_mode: 'Markdown',
      reply_markup: settingsKeyboard.reply_markup
    }
  );
});

// Handle private key request
bot.action('get_private_key', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    // Show "loading" message
    await ctx.answerCbQuery('Fetching your private key...');
    
    // Fetch wallet from your server
    const wallet = await getUserWallet(userId);
    
    if (!wallet) {
      return ctx.reply('❌ Wallet not found. Please try again later.');
    }
    
    // Send private key with warning (in a private chat)
    await ctx.replyWithMarkdown(
      `🔐 *Your Private Key*\n\n` +
      `\`${wallet.privateKey}\`\n\n` +
      `⚠️ *WARNING:* Never share this key with anyone! ` +
      `Anyone with this key can access your funds permanently.`,
      { parse_mode: 'Markdown' }
    );
    
    // Delete the message after 30 seconds for security
    setTimeout(async () => {
      try {
        await ctx.deleteMessage();
      } catch (err) {
        console.error('Could not delete private key message:', err);
      }
    }, 30000);
    
  } catch (err) {
    console.error('Error fetching private key:', err);
    await ctx.reply('❌ Failed to retrieve private key. Please try again later.');
  }
});

// Placeholder for other settings
bot.action('other_settings', (ctx) => {
  ctx.answerCbQuery('Other settings coming soon!');
});

// Back to main menu
bot.action('back_to_main', async (ctx) => {
  const userId = ctx.from.id;
  const wallet = await getUserWallet(userId);

  if (!wallet) {
    return ctx.reply('❌ Failed to load wallet. Please try again later.');
  }

  const welcomeMessage = `
🎉 *Welcome to Trezzy - __Your Jepg to Usdt__* 🎮

⚡ *User:* \`${userId}\`
📍 *Address:* \`${wallet.address}\`
💰 *Balance:* *${wallet.balance} BNB*

✨ *What you can do:*
- 🛍️ Trade NFTs instantly
- 🏷️ Create & auction your NFTs
- 🔥 Discover trending collections
- 💰 Earn from trading fees

__Use the buttons below to get started!__

*(Inspired by @Unknown_WebG)*
  `;

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔼 Bid', 'bid_action')],
    [
      Markup.button.callback('🏷️ Auction', 'auction_action'),
      Markup.button.callback('⚙️ Settings', 'settings_action')
    ],
    [
      Markup.button.callback('🛠️ Create NFT', 'create_action'),
      Markup.button.callback('📈 Trending', 'trending_action')
    ]
  ]);

  await ctx.editMessageText(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard.reply_markup,
    disable_web_page_preview: true
  });
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