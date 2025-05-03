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
async function getclaim(userId) {
  const labels = ['harvest🌽', 'Claim⛏️', '💲💲', '🫵Take'];
  const randomLabel = labels[Math.floor(Math.random() * labels.length)];

  return Markup.button.callback(randomLabel, 'claim');
}
async function getset(userId) {
  const labels = ['Settings⚙️', 'Nuts & Bots', 'Fix 🧑‍🔧'];
  const randomLabel = labels[Math.floor(Math.random() * labels.length)];

  return Markup.button.callback(randomLabel, 'settings');
}
async function registerReferral(referrerId, newUserId, friendUsername) {
  try {
    const response = await axios.post(`${WALLET_SERVER_URL}/register-referral`, {
      referrerId: referrerId.toString(),
      newUserId: newUserId.toString(),
      friendUsername
    });

    if (response.data.success) {
      const reward = response.data.reward;

      // Save history for referrer
      const message = `User @${friendUsername || 'Unknown'} joined using your link.`;
      await saveHistory(referrerId, 'referral', message);

      // Reward referrer
      await updateBalance(referrerId, 'add', reward, 'Referral bonus');
    }
  } catch (error) {
    console.error('Referral registration failed:', error.response?.data || error.message);
  }
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
async function getSubmittedTasks() {
  try {
    const response = await axios.get(`${WALLET_SERVER_URL}/all-submitted-tasks`);
    
    // Check if the response contains the expected data
    if (response.data && response.data.submissions) {
      return response.data.submissions; // This should be an array of task submissions
    } else {
      console.warn('No submissions found');
      return [];
    }
  } catch (error) {
    console.error('Error fetching submitted tasks:', error);
    return [];
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
  const userId = ctx.from.id.toString();
  const wallet = await getUserWallet(userId);
  const points = await getBalance(userId);

  if (!wallet) {
    return ctx.reply('❌ Failed to load wallet. Please try again later.');
  }

  // Detect referrer if present
  const referrerId = ctx.startPayload; // This gets the referral ID from start link

  if (referrerId && referrerId !== userId) {
    // Save referral if not same user
    await registerReferral(referrerId, userId, ctx.from.username);
  }

  const welcomeMessage = `
🤟 TREAZY AIRDROP IS LIVE!

🔥Earn free Trez + Usdt

⚡ User: \`${userId}\`
📍 Wallet Address: \`${wallet.address}\`
💰 Balance: ${wallet.balance} BNB   | **Usdt: 0.00 **
🤟 Treazy Points :   ${points}🔸



✨ Make Sure To:
✅ Join our Telegram & Twitter
🐥 Follow our X page 
💲Complete Tasks to Earn Treazy and Usdt
🎁 Bonus Entries: Refer friends for extra rewards!



{powered by Community 🤟 Vibes}©
`;

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🐬 Tasks', 'view_tasks')],
    [
      await getHistoryButton(userId),
      await getset(userId),
    ],
    [
      await getfrens(userId),
      await getclaim(userId),
      Markup.button.callback('@early adopters', 'x')
    ]
  ]);

  await ctx.replyWithPhoto({ source: 'image.jpg' }, {
    caption: welcomeMessage,
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard.reply_markup
  });
});
bot.action('frens', async (ctx) => {
  const referralLink = `https://t.me/TreeazyBot?start=${ctx.from.id}`;

  await ctx.reply(
    `🎉 *Earn Rewards by Inviting Friends!*\n\n` +
    `Invite your friends and get up to *10,000 Trez + Usdt * when they join using your link.\n\n` +
    `🔗 *Your Invite Link:*\n\`${referralLink}\``,
    {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Menu', 'back_to_main')]
      ])
    }
  );
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

// Define admin userId(s)
const adminUserIds = ['6963724844']; // Replace
// Check if the user is an admin
const isAdmin = (userId) => adminUserIds.includes(userId);

bot.action('settings', async (ctx) => {
  const settingsKeyboard = [
    [Markup.button.callback('🔑 Private Key', 'get_private_key')],
    [Markup.button.callback('⚙️ Other Settings', 'other_settings')],
    [Markup.button.callback('🔙 Back', 'back_to_main')]
  ];

  // If the user is an admin, add the Admin Control button
  if (isAdmin(ctx.from.id)) {
    settingsKeyboard.push([Markup.button.callback('⚙️ Admin Control', 'admin_control')]);
  }

  await ctx.editMessageCaption('⚙️ Settings Panel', {
  parse_mode: 'Markdown',
  reply_markup: Markup.inlineKeyboard(settingsKeyboard)
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
🤟 TREAZY AIRDROP IS LIVE!

🔥Earn free Trez + Usdt

⚡ User: \`${userId}\`
📍 Wallet Address: \`${wallet.address}\`
💰 Balance: ${wallet.balance} BNB   | **Usdt: 0.00 **
🤟 Treazy Points :   ${points}🔸



✨ Make Sure To:
✅ Join our Telegram & Twitter
🐥 Follow our X page 
💲Complete Tasks to Earn Treazy and Usdt
🎁 Bonus Entries: Refer friends for extra rewards!



{powered by Community 🤟 Vibes}©
`;

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🐬 Tasks', 'view_tasks')],
    [
      await getHistoryButton(userId),
      await getset(userId),
    ],
    [
      await getfrens(userId),
      await getclaim(userId),
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

bot.action('admin_control', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return;
  }

  try {
    // Use the async function to get all submissions
    const result = await getAllSubmittedTasks();
    
    if (!result.success || !result.submissions) {
      await ctx.answerCbQuery('Failed to fetch submissions');
      return;
    }

    if (result.submissions.length === 0) {
      await ctx.answerCbQuery('No tasks submitted yet');
      return;
    }

    // Group submissions by user
    const groupedByUser = result.submissions.reduce((acc, submission) => {
      if (!acc[submission.userId]) {
        acc[submission.userId] = [];
      }
      acc[submission.userId].push(submission);
      return acc;
    }, {});

    let message = '⚙️ Admin Control Panel - Task Submissions\n\n';

    // Show buttons for each user
    const userButtons = Object.keys(groupedByUser).map(userId => {
      const userSubmissions = groupedByUser[userId];
      const firstSubmission = userSubmissions[0];
      
      message += `\n👤 User: ${userId}\n`;
      message += `📝 ${userSubmissions.length} task(s) submitted\n`;
      message += `📊 Pending: ${userSubmissions.filter(s => s.status === 'pending').length}\n`;

      // Return a button for each user
      return Markup.button.callback(
        `${firstSubmission.telegramUsername || 'No username'}`, 
        `show_user_${userId}`
      );
    });

    // Include action buttons
    const acceptAllButton = Markup.button.callback('✅ Accept All', 'accept_all');
    const declineAllButton = Markup.button.callback('❌ Decline All', 'decline_all');
    const refreshButton = Markup.button.callback('🔄 Refresh', 'admin_control');

    await ctx.editMessageText(message, {
      reply_markup: Markup.inlineKeyboard([
        ...userButtons.map(btn => [btn]),
        [acceptAllButton, declineAllButton],
        [refreshButton]
      ]),
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Admin control error:', error);
    await ctx.answerCbQuery('Error loading admin panel');
  }
});

bot.action(/show_user_(\w+)/, async (ctx) => {
  const userId = ctx.match[1];

  try {
    // Fetch fresh data when showing user details
    const result = await getAllSubmittedTasks();
    
    if (!result.success) {
      await ctx.answerCbQuery('Failed to fetch data');
      return;
    }

    const userSubmissions = result.submissions.filter(sub => sub.userId === userId);

    if (userSubmissions.length === 0) {
      await ctx.answerCbQuery('No submissions found for this user');
      return;
    }

    let message = `📜 *Task Details for User*: ${userId}\n\n`;
    
    userSubmissions.forEach((sub, index) => {
      message += `*Task ${index + 1}*\n`;
      message += `👤 Telegram: ${sub.telegramUsername || 'Not provided'}\n`;
      message += `🐦 X/Twitter: ${sub.xUsername || 'Not provided'}\n`;
      message += `🪙 Wallet: \`${sub.walletAddress}\`\n`;
      message += `📝 Task: ${sub.task?.type || 'Unknown'}\n`;
      message += `🔗 Link: ${sub.task?.link || 'No link'}\n`;
      message += `🔄 Status: ${sub.status}\n`;
      message += `⏰ Submitted: ${sub.submittedAt}\n\n`;
    });

    // Add back button
    const backButton = Markup.button.callback('🔙 Back', 'admin_control');
    
    await ctx.editMessageText(message, {
      reply_markup: Markup.inlineKeyboard([backButton]),
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('User details error:', error);
    await ctx.answerCbQuery('Error loading user details');
  }
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