import { execSync } from 'child_process';
import { Logger } from '../src/utils/logger';

async function monitorAgents() {
  try {
    // Show all running instances
    Logger.info('Monitor', 'Current instances:');
    execSync('flyctl status', { stdio: 'inherit' });

    // Show logs from all instances
    Logger.info('Monitor', 'Instance logs:');
    execSync('flyctl logs', { stdio: 'inherit' });

    // Show metrics
    Logger.info('Monitor', 'Instance metrics:');
    execSync('flyctl metrics', { stdio: 'inherit' });

  } catch (error) {
    Logger.error('Monitor', 'Monitoring failed', { error });
  }
}

monitorAgents(); 