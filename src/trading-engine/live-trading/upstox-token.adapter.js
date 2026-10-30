'use strict';

/**
 * FAIL-CLOSED ADAPTER.
 * Replace the body of getAccessTokenForFirebaseUid with your existing
 * per-Firebase-user encrypted token lookup/decryption service.
 *
 * Do not read a global UPSTOX_ACCESS_TOKEN and do not accept tokens from clients.
 */
async function getAccessTokenForFirebaseUid(firebaseUid) {
  if (!firebaseUid) throw new Error('Authenticated Firebase user is required.');
  // TODO: integrate your current broker connection model/service here.
  // Example shape only (replace with your real service):
  // const connection = await BrokerConnection.findOne({ userId: firebaseUid, broker: 'UPSTOX', status: 'ACTIVE' });
  // if (!connection || !connection.encryptedAccessToken) throw new Error('Upstox is not connected.');
  // const token = decrypt(connection.encryptedAccessToken);
  // if (!token) throw new Error('Upstox token is unavailable.');
  // return token;
  throw new Error('Upstox per-user token adapter is not configured. Connect the existing encrypted broker-token service.');
}

module.exports = { getAccessTokenForFirebaseUid };
