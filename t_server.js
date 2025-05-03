const express = require('express');
const { ethers } = require('ethers');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config(); // Load .env file

admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), //newlines
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  })
});
const db = admin.firestore();

// Initialize BSC provider
const provider = new ethers.providers.JsonRpcProvider(
  'https://bsc-testnet.publicnode.com' // BSC Testnet RPC
);

const app = express();
app.use(cors());
app.use(express.json());

// Get Task Details
app.get('/get-task/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const doc = await db.collection('tasks').doc(taskId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = {
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate()?.toISOString()
    };

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin - Create Task (Unsecured)
app.post('/create-task', async (req, res) => {
  const { type, description, link } = req.body;

  if (!type || !description || !link) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Auto-delete after 24 hours
    const deleteAt = new Date();
    deleteAt.setHours(deleteAt.getHours() + 24);

    const taskRef = await db.collection('tasks').add({
      type,
      description,
      link,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      deleteAt,
      active: true
    });

    return res.json({
      success: true,
      taskId: taskRef.id,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});


// Updated /get-tasks endpoint (no deleteAt filter)
app.get('/get-tasks', async (req, res) => {
  const { userId } = req.query;

  try {
    // Get user's completed task IDs
    const submissions = await db.collection('taskSubmissions')
      .where('userId', '==', userId)
      .where('completed', '==', true)
      .get();

    const completedTaskIds = submissions.docs.map(doc => doc.data().taskId);

    // Get all active tasks regardless of deleteAt
    const tasksSnapshot = await db.collection('tasks')
      .where('active', '==', true)
      .get();

    const tasks = [];
    tasksSnapshot.forEach(doc => {
      if (!completedTaskIds.includes(doc.id)) {
        tasks.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()?.toISOString()
        });
      }
    });

    return res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});
// Updated submitTask endpoint
app.post('/submit-task', async (req, res) => {
  const { userId, taskId } = req.body;

  try {
    // Check for existing submission
    const existing = await db.collection('taskSubmissions')
      .where('userId', '==', userId)
      .where('taskId', '==', taskId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(400).json({ error: 'Task already submitted' });
    }

    const submissionRef = await db.collection('taskSubmissions').add({
      ...req.body,
      completed: true, // Mark as completed
      status: 'pending',
      submittedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      submissionId: submissionRef.id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Submission failed' });
  }
});

// Endpoint to get or create wallet
app.post('/get-wallet', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const userRef = db.collection('wallets').doc(userId);
    const doc = await userRef.get();

    if (doc.exists) {
      // Existing user - fetch balance
      const walletData = doc.data();
      const balance = await provider.getBalance(walletData.address);
      
      return res.json({
        address: walletData.address,
        privateKey: walletData.privateKey,
        balance: ethers.utils.formatEther(balance)
      });
    } else {
      // New user - create wallet
      const wallet = ethers.Wallet.createRandom();
      const balance = await provider.getBalance(wallet.address);

      await userRef.set({
        address: wallet.address,
        privateKey: wallet.privateKey, // Encrypt in production!
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({
        address: wallet.address,
        privateKey: wallet.privateKey, // Only for testing!
        balance: ethers.utils.formatEther(balance)
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});
// Save history with unread tracking
app.post('/save-history', async (req, res) => {
  const { userId, type, message, unread } = req.body; // Added unread

  if (!userId || !type || !message) {
    return res.status(400).json({ error: 'User ID, type and message are required' });
  }

  try {
    const historyRef = db.collection('userHistory')
      .doc(userId)
      .collection('activities')
      .doc(); // Auto-generated ID

    await historyRef.set({
      type,
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ 
      success: true, 
      historyId: historyRef.id
    });
  } catch (error) {
    console.error('Save history error:', error);
    res.status(500).json({ 
      error: 'Failed to save history',
      details: error.message 
    });
  }
});
// Get latest 5 history items
app.get('/get-history/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const snapshot = await db.collection('userHistory')
      .doc(userId)
      .collection('activities')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      type: doc.data().type,
      message: doc.data().message,
      timestamp: doc.data().timestamp?.toDate()?.toISOString()
    }));

    return res.json({ history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error while fetching history' });
  }
});

// Delete all history for a user
app.delete('/delete-history/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Get all documents in the subcollection
    const activitiesRef = db.collection('userHistory')
      .doc(userId)
      .collection('activities');
    
    const snapshot = await activitiesRef.get();
    
    // Create a batch delete operation
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    return res.json({ 
      success: true,
      message: `Deleted ${snapshot.size} history items`,
      count: snapshot.size
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error while deleting history' });
  }
});

// Balance management endpoint
app.post('/update-balance', async (req, res) => {
  const { userId, action, amount, reason } = req.body;

  if (!userId || !action || amount === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  const validActions = ['add', 'deduct', 'set'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action type' });
  }

  try {
    const userRef = db.collection('userBalances').doc(userId);
    const doc = await userRef.get();
    
    let currentBalance = 0;
    if (doc.exists) {
      currentBalance = doc.data().balance || 0;
    }

    let newBalance;
    switch (action) {
      case 'add':
        newBalance = currentBalance + amount;
        break;
      case 'deduct':
        newBalance = currentBalance - amount;
        if (newBalance < 0) newBalance = 0;
        break;
      case 'set':
        newBalance = amount;
        break;
    }

    await userRef.set({ balance: newBalance }, { merge: true });

    // Save to history except for 'set' actions
    if (action !== 'set') {
      const historyMessage = `${amount} points 🤟 has been ${action === 'add' ? 'added to' : 'deducted from'} your balance ⭐`;
      await db.collection('userHistory').doc(userId).collection('activities').add({
        type: 'balance',
        message: historyMessage,
        amount: amount,
        action: action,
        reason: reason || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return res.json({
      success: true,
      newBalance,
      message: action === 'set' ? 'Balance set successfully' : `Balance ${action}ed successfully`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error while updating balance' });
  }
});

// Get balance endpoint
app.get('/get-balance/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const doc = await db.collection('userBalances').doc(userId).get();
    
    if (!doc.exists) {
      return res.json({ balance: 0 });
    }

    return res.json({ balance: doc.data().balance || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error while fetching balance' });
  }
});
// Claim cooldown endpoint
app.post('/check-claim', async (req, res) => {
  const { userId } = req.body;
  const COOLDOWN_HOURS = 6;

  try {
    const doc = await db.collection('userClaims').doc(userId).get();
    const now = new Date();
    const lastClaim = doc.exists ? doc.data().lastClaim?.toDate() : null;

    if (lastClaim) {
      const nextClaim = new Date(lastClaim.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
      if (now < nextClaim) {
        const hoursLeft = Math.ceil((nextClaim - now) / (60 * 60 * 1000));
        return res.json({
          canClaim: false,
          hoursLeft
        });
      }
    }

    // Update last claim time
    await db.collection('userClaims').doc(userId).set({
      lastClaim: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.json({ canClaim: true });

  } catch (error) {
    console.error('Claim check error:', error);
    res.status(500).json({ error: 'Server error during claim check' });
  }
});
// POST /register-referral (Firebase Firestore version)
app.post('/register-referral', async (req, res) => {
  const { referrerId, newUserId, friendUsername } = req.body;

  if (referrerId === newUserId) {
    return res.json({ success: false, reason: "Self-referral not allowed" });
  }

  try {
    const referralDoc = await db.collection('referrals').doc(newUserId).get();

    if (referralDoc.exists) {
      return res.json({ success: false, reason: "User already referred" });
    }

    // Random reward between 500 - 10000
    const reward = Math.floor(Math.random() * (10000 - 500 + 1)) + 500;

    await db.collection('referrals').doc(newUserId).set({
      referrerId,
      newUserId,
      friendUsername,
      reward,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, reward });

  } catch (error) {
    console.error('Referral registration error:', error);
    res.status(500).json({ success: false, error: 'Server error while registering referral' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wallet server running on port ${PORT}`);
});
