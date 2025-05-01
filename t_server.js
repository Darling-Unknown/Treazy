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
// Save history (type + message only)
app.post('/save-history', async (req, res) => {
  const { userId, type, message } = req.body;

  if (!userId || !type || !message) {
    return res.status(400).json({ error: 'User ID, type and message are required' });
  }

  try {
    const historyRef = db.collection('userHistory').doc(userId).collection('activities').doc();
    
    await historyRef.set({
      type,
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ 
      success: true, 
      message: 'History saved',
      historyId: historyRef.id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error while saving history' });
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wallet server running on port ${PORT}`);
});
