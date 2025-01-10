import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runDemo() {
  try {
    const cwd = process.cwd();
    
    const commands = [
      // Create new window with specific dimensions
      `osascript -e '
        tell application "iTerm2"
          create window with default profile
          tell current session of current window
            set columns to 120
            set rows to 30
            write text "cd ${cwd} && AGENT_NAME=ducky P2P_PORT=8000 tsx ./scripts/chat-client.ts"
            
            -- Split vertically for Soulie
            split vertically with default profile
            tell second session
              write text "cd ${cwd} && AGENT_NAME=soulie P2P_PORT=8002 tsx ./scripts/chat-client.ts"
            end tell
            
            -- Split vertically again for Glu
            split vertically with default profile
            tell third session
              write text "cd ${cwd} && AGENT_NAME=glu P2P_PORT=8004 tsx ./scripts/chat-client.ts"
            end tell
          end tell
        end tell'`
    ];

    // Execute commands sequentially
    for (const cmd of commands) {
      await execAsync(cmd);
      // Give more time for the processes to start
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('Failed to start demo:', error);
    process.exit(1);
  }
}

runDemo(); 