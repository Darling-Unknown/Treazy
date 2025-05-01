const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');

// Initialize bot and web server
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// Wallet server configuration
const WALLET_SERVER_URL = process.env.SERVER || 'http://localhost:3000';
const CLAIM_AMOUNT = 3000;

// ================= UTILITY FUNCTIONS =================
async function getHistoryButton(userId) {
  const labels = ['📜 History 🔸🔹', '📢 Notification ◻️', 'Recents 👀', '🔔 Beep👀'];
  const randomLabel = labels[Math.floor(Math.random() * labels.length)];

  return Markup.button.callback(randomLabel, 'history');
}
async function getfrens(userId) {
  const labels = ['Bro🤟', 'Team😎', 'Friends 🤝', 'Pack 🦊'];
  const randomLabel = labels[Math.floor(Math.random() * labels.length)];

  return Markup.button.callback(randomLabel, 'frens');
}
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
      type,
      message,
      unread: true
    });
    return response.data;
  } catch (error) {
    console.error('Save failed:', error.response?.data || error.message);
    return { success: false };
  }
}
// Updated getTasks function
async function getTasks(userId) {
  try {
    const response = await axios.get(`${WALLET_SERVER_URL}/get-tasks?userId=${userId}`);
    return response.data.tasks || [];
  } catch (error) {
    console.error('Get tasks error:', error);
    return [];
  }
}

// Get task details
async function getTaskDetails(taskId) {
  try {
    const response = await axios.get(`${WALLET_SERVER_URL}/get-task/${taskId}`);
    return response.data;
  } catch (error) {
    console.error('Get task error:', error);
    return null;
  }
}

// Submit task completion
async function submitTask(data) {
  try {
    const response = await axios.post(`${WALLET_SERVER_URL}/submit-task`, {
      userId: data.userId,
      taskId: data.taskId,
      walletAddress: data.walletAddress,
      telegramUsername: data.telegramUsername,
      xUsername: data.xUsername,
      completed: true
    });
    return response.data;
  } catch (error) {
    console.error('Submission error:', error);
    return { success: false };
  }
}

async function getHistory(userId) {
  try {
    const response = await axios.get(`${WALLET_SERVER_URL}/get-history/${userId}`);
    return response.data?.history?.map(item => ({
      ...item,
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

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function handleClaim(userId) {
  try {
    const cooldownCheck = await axios.post(`${WALLET_SERVER_URL}/check-claim`, {
      userId: userId.toString()
    });

    if (!cooldownCheck.data.canClaim) {  
      return `⏳ Come back in ${cooldownCheck.data.hoursLeft} hour(s) to claim again`;  
    }  

    const balanceResult = await updateBalance(userId, 'add', CLAIM_AMOUNT, 'Daily claim');  
    if (!balanceResult.success) {  
      throw new Error('Failed to update balance');  
    }  

    await saveHistory(userId, 'claim', 'Claimed 🤟 Points');  
    return `🎉 You have claimed ${CLAIM_AMOUNT.toLocaleString()} points!\nNew balance: ${balanceResult.newBalance}`;
  } catch (error) {
    console.error('Claim failed:', error);
    return '❌ Failed to process claim. Please try again later.';
  }
}

// ================= BOT HANDLERS =================
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const wallet = await getUserWallet(userId);
  const points = await getBalance(userId);

  if (!wallet) {
    return ctx.reply('❌ Failed to load wallet. Please try again later.');
  }

  const welcomeMessage = `
🎉 TREZZY AIRDROP IS LIVE!

🔥Earn free Treez + Usdt

⚡ User: \`${userId}\`
📍 Wallet Address: \`${wallet.address}\`
💰 Balance: ${wallet.balance} BNB | **Usdt: xcxxx **
🤟 Treazy Points : † ${points}

✨ Make Sure To:

✅ Join our Telegram & Twitter (xxxxxx)

🐥 Follow our X page (Xxx)

💲Complete Tasks to Earn Treazy and Usdt

🎁 Bonus Entries: Refer friends for extra rewards!

{powered by Community 🤟 Vibes}©
`;

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🐬 Tasks', 'view_tasks')],
    [
      await getHistoryButton(userId),
      Markup.button.callback('⚙️ Settings', 'settings')
    ],
    [
      await getfrens(userId),
      Markup.button.callback('⛏️ Claim', 'claim'),
      Markup.button.callback('@early adopters', 'x')
    ]
  ]);

  await ctx.replyWithPhoto({ source: 'image.jpg' }, {
    caption: welcomeMessage,
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard.reply_markup
  });
});

bot.action('Tasks', async (ctx) => {
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🤟 Submit', 'submit')],
    [Markup.button.callback('Go To 🌝 ', '')],
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  // Fixed: Use editMessageMedia instead of editMessageText
  await ctx.editMessageMedia({
    type: 'photo',
    media: { source: 'image.jpg' },
    caption: '🎯 *Available Tasks*\n\n1. Join our Telegram group\n2. Follow us on Twitter\n3. Refer 3 friends\n\nComplete tasks to earn rewards!',
    parse_mode: 'Markdown'
  }, {
    reply_markup: settingsKeyboard.reply_markup
  });
});

bot.action('x', async (ctx) => {
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  // Fixed: Media-aware edit
  await ctx.editMessageMedia({
    type: 'photo',
    media: { source: 'image.jpg' },
    caption: 'Submit The Early Adopter Code Below To Earn 10$ + 20,000points',
    parse_mode: 'Markdown'
  }, {
    reply_markup: settingsKeyboard.reply_markup
  });
});

bot.action('settings', async (ctx) => {
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔑 Private Key', 'get_private_key')],
    [Markup.button.callback('⚙️ Other Settings', 'other_settings')],
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  // Fixed: Media-aware edit
  await ctx.editMessageMedia({
    type: 'photo',
    media: { source: 'image.jpg' },
    caption: '⚙️ Settings Panel {nuts and bolts🔩}',
    parse_mode: 'Markdown'
  }, {
    reply_markup: settingsKeyboard.reply_markup
  });
});

bot.action('history', async (ctx) => {
  const userId = ctx.from.id;
  const history = await getHistory(userId);

  const historyText = history.length > 0
    ? `📜 *Your Recent Activities*\n\n` +
      history.slice(0, 10).map((item, index) =>
        `${index + 1}. ${item.message}\n   ⌚ ${formatDate(item.timestamp)}`
      ).join('\n\n')
    : "📭 No history yet!";

  const historyKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🗑️ Clear History', 'clear')],
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ]);

  // Fixed: Media-aware edit
  await ctx.editMessageMedia({
    type: 'photo',
    media: { source: 'image.jpg' },
    caption: historyText,
    parse_mode: 'Markdown'
  }, {
    reply_markup: historyKeyboard.reply_markup
  });
});
bot.action('view_tasks', showTaskList);

  async function showTaskList(ctx) {
  const tasks = await getTasks(ctx.from.id.toString());

  const messageContent = {
    caption: tasks.length === 0 
      ? '🎉 No pending tasks - you\'ve completed them all!' 
      : '📋 Available Tasks:',
    parse_mode: 'Markdown'
  };

  const buttons = tasks.length > 0
    ? tasks.map((task, index) => 
        [Markup.button.callback(`${index + 1}️⃣ ${task.type}`, `view_task_${task.id}`)]
      )
    : [];

  if (ctx.update.callback_query.message?.photo) {
    await ctx.editMessageMedia({
      type: 'photo',
      media: { source: 'image.jpg' },
      ...messageContent
    }, {
      reply_markup: Markup.inlineKeyboard([
        ...buttons,
        [Markup.button.callback('🔙 Back', 'back_to_main')]
      ]).reply_markup
    });
  } else {
    await ctx.editMessageText(messageContent.caption, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        ...buttons,
        [Markup.button.callback('🔙 Back', 'back_to_main')]
      ]).reply_markup
    });
  }
}
// Single task view handler
bot.action(/^view_task_(.*)/, async (ctx) => {
  const taskId = ctx.match[1];
  const task = await getTaskDetails(taskId);
  const userId = ctx.from.id;

  if (!task) {
    return ctx.answerCbQuery('Task not found');
  }

  // Get user wallet
  const wallet = await getUserWallet(userId);
  if (!wallet) {
    return ctx.answerCbQuery('Wallet not loaded');
  }

  // If editing a photo message
  await ctx.editMessageMedia({
    type: 'photo',
    media: { source: 'image.jpg' }, // Replace with your task image path
    caption:
      `🛠️ *Task Details*\n\n` +
      `📝 ${task.description}\n\n` +
      `🆔 Task ID: ${task.id}`,
    parse_mode: 'Markdown'
  }, {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url('🔗 Open Link', task.link)],
      [Markup.button.callback('✅ Submit Completion', `submit_task_${task.id}`)],
      [Markup.button.callback('🔙 Back to Tasks', 'view_tasks')]
    ]).reply_markup
  });
});
// Task submission handler
// Task submission handler
bot.action(/^submit_task_(.*)/, async (ctx) => {
  const taskId = ctx.match[1];
  const userId = ctx.from.id;
  const wallet = await getUserWallet(userId);

  const userData = {
    userId: userId.toString(),
    taskId,
    walletAddress: wallet.address,
    telegramUsername: ctx.from.username ? `@${ctx.from.username}` : 'Not provided',
    xUsername: 'Not provided'
  };

  const result = await submitTask(userData);

  if (result.success) {
    await ctx.answerCbQuery('✅ Task submitted for review!');
    const historyMessage = `You submitted task ${taskId} 💪 (under review)`;
    await saveHistory(userId, 'task_submission', historyMessage);

    // Call the shared function directly
    return await showTaskList(ctx);
  } else {
    await ctx.answerCbQuery('❌ Submission failed');
  }
});
bot.action('claim', async (ctx) => {
  const response = await handleClaim(ctx.from.id);
  ctx.reply(response);
});

bot.action('get_private_key', async (ctx) => {
  const userId = ctx.from.id;
  try {
    await ctx.answerCbQuery('Fetching your private key...');
    const wallet = await getUserWallet(userId);  

    if (!wallet) {  
      return ctx.reply('❌ Wallet not found. Please try again later.');  
    }  

    await ctx.replyWithMarkdown(  
      `🔐 *Your Private Key*\n\n` +  
      `\`${wallet.privateKey}\`\n\n` +  
      `⚠️ *WARNING:* Never share this key with anyone! ` +  
      `Anyone with this key can access your funds permanently.`,  
      { parse_mode: 'Markdown' }  
    );  

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

bot.action('clear', async (ctx) => {
  const userId = ctx.from.id;
  const result = await deleteHistory(userId);

  if (result.success) {
    await ctx.editMessageText('🧹 History cleared successfully!');
  } else {
    await ctx.reply(`❌ Failed to clear history: ${result.error}`);
  }
});

bot.action('other_settings', (ctx) => {
  ctx.answerCbQuery('Other settings coming soon!');
});
bot.action('back_to_main', async (ctx) => {
  const userId = ctx.from.id;
  const wallet = await getUserWallet(userId);
  const points = await getBalance(userId);

  if (!wallet) {
    return ctx.reply('❌ Failed to load wallet. Please try again later.');
  }

  const welcomeMessage = `
🎉 TREZZY AIRDROP IS LIVE!

🔥Earn free Treez + Usdt

⚡ User: \`${userId}\`
📍 Wallet Address: \`${wallet.address}\`
💰 Balance: ${wallet.balance} BNB | **Usdt: xcxxx **
🤟 Treazy Points : † ${points}

✨ Make Sure To:

✅ Join our Telegram & Twitter (xxxxxx)

🐥 Follow our X page (Xxx)

💲Complete Tasks to Earn Treazy and Usdt

🎁 Bonus Entries: Refer friends for extra rewards!

{powered by Community 🤟 Vibes}©
`;

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🐬 Tasks', 'Tasks')],
    [
      await getHistoryButton(userId),
      Markup.button.callback('⚙️ Settings', 'settings')
    ],
    [
      await getfrens(userId),
      Markup.button.callback('⛏️ Claim', 'claim'),
      Markup.button.callback('@early adopters', 'x')
    ]
  ]);

  // Keep existing correct implementation
  await ctx.editMessageMedia({
    type: 'photo',
    media: { source: 'image.jpg' },
    caption: welcomeMessage,
    parse_mode: 'Markdown'
  }, {
    reply_markup: inlineKeyboard.reply_markup
  });
});

// ================= WEBHOOK SETUP =================
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'active',
    service: 'Trezzy NFT Bot',
    timestamp: Date.now()
  });
});

app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`Wallet server: ${WALLET_SERVER_URL}`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});