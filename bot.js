const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');

// Initialize bot and web server
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

async function getHistoryButton(ctx) {
  const userId = ctx.from.id;
  const hasNew = await hasNewHistory(userId);
  return Markup.button.callback(
    hasNew ? '📜 History ✳️' : '📜 History',
    'history'
  );
}
async function hasNewHistory(userId) {
  try {
    const response = await axios.get(`${WALLET_SERVER_URL}/has-new-history/${userId}`);
    return response.data.hasNew;
  } catch (error) {
    console.error('New history check failed:', error);
    return false;
  }
}

async function updateLastViewed(userId) {
  try {
    await axios.post(`${WALLET_SERVER_URL}/update-last-viewed`, { userId });
  } catch (error) {
    console.error('Failed to update last viewed:', error);
  }
}

// Wallet server configuration
const WALLET_SERVER_URL = process.env.SERVER || 'http://localhost:3000';
const CLAIM_AMOUNT = 3000;

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

async function saveHistory(userId, type, message) {
  try {
    const response = await axios.post(`${WALLET_SERVER_URL}/save-history`, {
      userId: userId.toString(),
      type: type,
      message: message
    });
    return response.data;
  } catch (error) {
    console.error('History server error:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to save history'
    };
  }
}
// Update your getHistory function to better handle the response:
async function getHistory(userId) {
  try {
    const response = await axios.get(`${WALLET_SERVER_URL}/get-history/${userId}`);
    return response.data?.history?.map(item => ({
      ...item,
      // Convert Firestore timestamp to readable format
      timestamp: item.timestamp || new Date().toISOString()
    })) || [];
  } catch (error) {
    console.error('Get history error:', error);
    return [];
  }
}
async function deleteHistory(userId) {
  try {
    const response = await axios.delete(`${WALLET_SERVER_URL}/delete-history/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Delete history error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to delete history'
    };
  }
}
// Update balance function
async function updateBalance(userId, action, amount, reason = '') {
  try {
    const response = await axios.post(`${WALLET_SERVER_URL}/update-balance`, {
      userId: userId.toString(),
      action,
      amount: Number(amount),
      reason
    });
    return response.data;
  } catch (error) {
    console.error('Update balance error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to update balance'
    };
  }
}

// Get balance function
async function getBalance(userId) {
  try {
    const response = await axios.get(`${WALLET_SERVER_URL}/get-balance/${userId}`);
    return response.data.balance || 0;
  } catch (error) {
    console.error('Get balance error:', error.response?.data || error.message);
    return {
      error: error.response?.data?.error || 'Failed to fetch balance',
      balance: 0
    };
  }
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const wallet = await getUserWallet(userId);
  const points = await getBalance(userId);

  if (!wallet) {
    return ctx.reply('❌ Failed to load wallet. Please try again later.');
  }

  const welcomeMessage = `
🎉 ***TREZZY AIRDROP IS LIVE!***

🔥**Earn free _Treez + Usdt_**

⚡ *User:* \`${userId}\`  
📍 *Wallet Address:* \`${wallet.address}\`  
💰 *Balance*: *${wallet.balance} BNB* | **Usdt: xcxxx **
🤟 *Treazy Points* : † ${points} 
 
✨ **Make Sure To:**  
- ✅ **Join our Telegram & Twitter** (xxxxxx)  
- 🐥 **Follow our X page** (Xxx)
- 💲**Complete Tasks to Earn Treazy and Usdt**
- 🎁 **Bonus Entries:** Refer friends for extra rewards!

_{powered by Community 🤟 Vibes}©_
`;
  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🐬 Tasks', 'Tasks')],
    [
      await getHistoryButton(ctx), // Dynamic button
      Markup.button.callback('⚙️ Settings', 'settings')
    ],
    [
      Markup.button.callback('💁 Niggas', 'frens'),
      Markup.button.callback('⛏️claim', 'claim'),
      Markup.button.callback('@early adopters', 'x')
    ]
  ]);

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard.reply_markup,
    disable_web_page_preview: true
  });
});


async function handleClaim(userId) {
  try {
    // 1. Check claim cooldown status
    const cooldownCheck = await axios.post(`${WALLET_SERVER_URL}/check-claim`, {
      userId: userId.toString()
    });

    if (!cooldownCheck.data.canClaim) {
      return `⏳ Come back in ${cooldownCheck.data.hoursLeft} hour(s) to claim again`;
    }

    // 2. Update balance (frontend)
    const balanceResult = await updateBalance(userId, 'add', CLAIM_AMOUNT, 'Daily claim');
    if (!balanceResult.success) {
      throw new Error('Failed to update balance');
    }

    // 3. Save to history
    await saveHistory(userId, 'claim', 'Claimed 🤟 Points');

    return `🎉 You have claimed ${CLAIM_AMOUNT.toLocaleString()} points!\nNew balance: ${balanceResult.newBalance}`;

  } catch (error) {
    console.error('Claim failed:', error);
    return '❌ Failed to process claim. Please try again later.';
  }
}

// Attach to your button
bot.action('claim', async (ctx) => {
  const response = await handleClaim(ctx.from.id);
  ctx.reply(response);
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
bot.action('history', async (ctx) => {
  const userId = ctx.from.id;
  const history = await getHistory(userId);
  await updateLastViewed(userId);

  const historyText = history.length > 0 
    ? `📜 *Your Recent Activities*\n\n` +
      history.slice(0, 10).map((item, index) => 
        `${index + 1}. ${item.message}\n   ⌚ ${formatDate(item.timestamp)}`
      ).join('\n\n')
    : "📭 No history yet!";

  const historyKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🗑️ Clear History', 'clear_history')],
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  await ctx.editMessageText(historyText, {
    parse_mode: 'Markdown',
    reply_markup: historyKeyboard.reply_markup
  });
});

// Helper function to format dates
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
bot.action('Tasks', async (ctx) => {
  // Create settings menu with two buttons
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🤟 Submit', 'submit')],
    [Markup.button.callback('Go To 🌝 ', '')],
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  await ctx.editMessageText('tasks: **${taskno}**\n\n ${taskdesc}',
    {
      parse_mode: 'Markdown',
      reply_markup: settingsKeyboard.reply_markup
    }
  );
});
bot.action('x', async (ctx) => {
  // Create settings menu with two buttons
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  await ctx.editMessageText('Submit The Early Adopter Code Below To Earn **10$ + 20,000**points',
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
// Add this handler:
bot.action('clear', async (ctx) => {
  const userId = ctx.from.id;
  const result = await deleteHistory(userId);
  
  if (result.success) {
    await ctx.editMessageText('✅ History cleared successfully!');
  } else {
    await ctx.editMessageText('❌ Failed to clear history. Please try again.');
  }
  
  // Return to main menu after 2 seconds
  setTimeout(() => ctx.answerCbQuery(), 2000);
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
🎉 ***TREZZY AIRDROP IS LIVE!***

🔥**Earn free _Treez + Usdt_**

⚡ *User:* \`${userId}\`  
📍 *Wallet Address:* \`${wallet.address}\`  
💰 *Balance*: *${wallet.balance} BNB* | **Usdt: xcxxx **
🤟 *Treazy Points*: xxxxxxx
 
✨ **Make Sure To:**  
- ✅ **Join our Telegram & Twitter** (xxxxxx)  
- 🐥 **Follow our X page** (Xxx)
- 💲**Complete Tasks to Earn Treazy and Usdt**
- 🎁 **Bonus Entries:** Refer friends for extra rewards!

_{powered by Community 🤟 Vibes}©_
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
//£nd
//147 jagak