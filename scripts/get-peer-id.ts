import { createFromProtobuf } from '@libp2p/peer-id-factory';
import dotenv from 'dotenv';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';

dotenv.config();

async function getPeerId(privateKey: string) {
  // Convert hex private key to Uint8Array
  const keyBytes = new Uint8Array(
    Buffer.from(privateKey.replace('0x', ''), 'hex')
  );
  
  // Create peer ID using Ed25519 key
  const peerId = await createFromProtobuf(keyBytes);
  
  // Get the string representation
  const peerIdString = uint8ArrayToString(peerId.toBytes(), 'base58btc');
  
  return peerIdString;
}

async function main() {
  // Get peer IDs for ducky and glu
  const duckyPeerId = await getPeerId(process.env.DUCKY_PRIVATE_KEY || '');
  const gluPeerId = await getPeerId(process.env.GLU_PRIVATE_KEY || '');

  console.log('Ducky Peer ID:', duckyPeerId);
  console.log('Glu Peer ID:', gluPeerId);

  // Print full multiaddrs
  console.log('\nBootstrap Nodes:');
  console.log(`'/dns4/us-east.hosting.openpond.ai/tcp/8000/p2p/${duckyPeerId}',  // Ducky (US East)`);
  console.log(`'/dns4/us-west.hosting.openpond.ai/tcp/8000/p2p/${gluPeerId}',    // Glu (US West)`);
}

main().catch(console.error); 