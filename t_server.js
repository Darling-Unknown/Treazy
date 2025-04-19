const express = require('express');
const { ethers } = require('ethers');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firebase
const serviceAccount = require('./.env'); // Download from Firebase console
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wallet server running on port ${PORT}`);
});
