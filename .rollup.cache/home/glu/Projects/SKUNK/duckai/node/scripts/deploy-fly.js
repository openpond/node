import { execSync } from 'child_process';
import { Logger } from '../src/utils/logger';
const REGIONS = [
    "sjc", "sea", "ord", "dfw", "iad", "ewr", "lhr",
    "ams", "fra", "mad", "cdg", "nrt", "hkg", "sin",
    "syd", "gru"
];
async function deployToFly() {
    try {
        // Check if flyctl is installed
        try {
            execSync('flyctl version');
        }
        catch {
            Logger.info('Deploy', 'Installing flyctl...');
            execSync('curl -L https://fly.io/install.sh | sh');
        }
        // Create machines in each region
        Logger.info('Deploy', 'Creating machines in each region...');
        for (let index = 0; index < REGIONS.length; index++) {
            const region = REGIONS[index];
            const instanceName = `p2p-agent-${region}`;
            Logger.info('Deploy', `Creating machine in ${region}...`);
            try {
                // Create machine in specific region with unique env vars
                execSync(`flyctl machine run . \
          --region ${region} \
          --name ${instanceName} \
          --env AGENT_NAME=${instanceName} \
          --env REGION=${region} \
          --env INSTANCE_ID=${index + 1} \
          --env HOST=0.0.0.0`, {
                    stdio: 'inherit'
                });
            }
            catch (error) {
                Logger.error('Deploy', `Failed to create machine in ${region}`, { error });
            }
        }
        Logger.info('Deploy', 'Deployment complete!');
        // Show running instances
        Logger.info('Deploy', 'Running instances:');
        execSync('flyctl machine list', { stdio: 'inherit' });
    }
    catch (error) {
        Logger.error('Deploy', 'Deployment failed', { error });
        process.exit(1);
    }
}
deployToFly();
//# sourceMappingURL=deploy-fly.js.map