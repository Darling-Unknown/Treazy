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
🎉 ***TREZZY AIRDROP IS LIVE!***

🔥*Earn free **Treez + Usdt***

⚡ *User:* \`${userId}\`  
📍 *Wallet Address:* \`${wallet.address}\`  
💰 *Balance*: *${wallet.balance} BNB* | **Usdt: xcxxx **
🤟 *Treazy Points*: xxxxxxx
 
✨ **Make Sure To:**  
- ✅ **Join our Telegram & Twitter** (xxxxxx)  
- 🐥 **Follow our X page** (Xxx)
- 💲**Complete Tasks to Earn Treazy and Usdt**
- 🎁 **Bonus Entries:** Refer friends for extra rewards!

__{powered by Community 🤟 Vibes}©__
  `;

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🐬 Tasks', 'Tasks')],
    [
      Markup.button.callback('📜 History', 'history'),
      Markup.button.callback('⚙️ Settings', 'settings')
    ],
    [
      Markup.button.callback('💁 Niggas', 'frens'),
      Markup.button.callback('@early adopters', 'x')
    ]
  ]);

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard.reply_markup,
    disable_web_page_preview: true
  });
});
// Add this near your other action handlers
bot.action('settings', async (ctx) => {
  // Create settings menu with two buttons
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔑 Private Key', 'get_private_key')],
    [Markup.button.callback('⚙️ Other Settings', 'other_settings')],
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  await ctx.editMessageText('⚙️ Settings Panel __{nuts and bolts🔩}__',
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
    }, 10000);
    
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
🎉 **🚀 *TREZZY AIRDROP IS LIVE!* 🚀** 🎉  

🔥*Earn free Treezy and Usdt*🔥  

⚡ *User:* \`${userId}\`  
📍 *Wallet Address:* \`${wallet.address}\`  
💰 *Bnb Balance*: *${wallet.balance} BNB*
💲 *Usdt Balance*: xxxxx
🤟 *Treazy Points*: xxxxxxx
 
✨ **Make Sure To:**  
- ✅ **Join our Telegram & Twitter** (xxxxxx)  
- ✖️ **Follow our X page** (Xxx)
- 🐥 **Complete Tasks to Earn Treazy and Usdt**
- 🎁 **Bonus Entries:** Refer friends for extra rewards!

__{powered by Community 🤟 Vibes}©__
  `;

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🐬 Tasks', 'Tasks')],
    [
      Markup.button.callback('📜 History', 'history'),
      Markup.button.callback('⚙️ Settings', 'settings')
    ],
    [
      Markup.button.callback('💁 Niggas', 'frens'),
      Markup.button.callback('@early adopters', 'x')
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