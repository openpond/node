import { createSecp256k1PeerId } from '@libp2p/peer-id-factory';
import fs from 'fs/promises';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { Logger } from '../src/utils/logger';

async function generateBootstrapIds() {
  const bootstrapNodes = ['bootstrap-1', 'bootstrap-2', 'bootstrap-3', 'bootstrap-4'];
  const regions = {
    'bootstrap-1': 'us-east',
    'bootstrap-2': 'us-west',
    'bootstrap-3': 'eu-west',
    'bootstrap-4': 'sea'
  } as const;

  await fs.mkdir('./bootstrap-keys', { recursive: true });
  
  for (const node of bootstrapNodes) {
    const peerId = await createSecp256k1PeerId();
    
    // Store the marshalled private key directly
    const peerInfo = {
      id: peerId.toString(),
      privateKey: uint8ArrayToString(peerId.privateKey ?? new Uint8Array(), 'base64pad')
    };
    
    await fs.writeFile(
      `./bootstrap-keys/${node}-peer.json`,
      JSON.stringify(peerInfo, null, 2)
    );

    Logger.info('Bootstrap', `Generated ID for ${node}`, {
      peerId: peerId.toString(),
      region: regions[node as keyof typeof regions]
    });
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateBootstrapIds().catch(console.error);
} 