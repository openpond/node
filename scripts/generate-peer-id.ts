import { createSecp256k1PeerId } from '@libp2p/peer-id-factory';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';

async function generateAndSavePeerId() {
  const peerId = await createSecp256k1PeerId();
  
  // Get bytes representation that can be stored and reused
  const peerIdBytes = peerId.toBytes();
  const peerIdString = uint8ArrayToString(peerIdBytes, 'base64');
  
  console.log('Save this in your .env:');
  console.log(`PEER_ID_BYTES=${peerIdString}`);
}

generateAndSavePeerId(); 