import { config } from "dotenv";
import { resolve } from "path";
import { Logger } from "./logger";
import { TestRunner } from "./TestRunner";

// Initialize logger and load environment variables
(async () => {
  await Logger.init("p2p-test");

  // Load environment variables
  const envFile = process.env.ENV_FILE || ".env";
  config({ path: resolve(process.cwd(), envFile) });

  await main().catch(console.error);
})();

async function main() {
  const funderPrivateKey = process.env.FUNDER_PRIVATE_KEY;
  if (!funderPrivateKey) {
    throw new Error("FUNDER_PRIVATE_KEY environment variable is required");
  }

  // Contract addresses and network config
  const registryAddress = "0x05430ECEc2E4D86736187B992873EA8D5e1f1e32"; // AgentRegistry on Base Sepolia
  const rpcUrl = "https://sepolia.base.org"; // Base Sepolia RPC

  const runner = new TestRunner(
    registryAddress,
    rpcUrl,
    funderPrivateKey as `0x${string}`
  );

  let testResult;
  try {
    await runner.init();
    Logger.info("Test", "Starting P2P network test");

    // Start bootstrap nodes
    await runner.startBootstrapNodes(2);
    Logger.info("Test", "Bootstrap nodes started");

    // Create test agents
    const agentCount = 5;
    await runner.createAgents(agentCount);
    Logger.info("Test", `Created ${agentCount} test agents`);

    // Wait for peer discovery
    Logger.info("Test", "Waiting for peer discovery...");
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

    // Run message test
    Logger.info("Test", "Running message test");
    testResult = await runner.runMessageTest();

    // Generate and display test summary
    const summary = runner.generateSummary();

    console.log("\n========================================");
    console.log("           Test Summary");
    console.log("========================================");
    console.log(`Total Tests:      ${summary.totalTests}`);
    console.log(`Passed:           ${summary.passedTests}`);
    console.log(`Failed:           ${summary.failedTests}`);
    console.log(`Total Duration:   ${summary.duration}ms`);
    console.log("----------------------------------------");

    // Display detailed results
    console.log("\nDetailed Results:");
    summary.results.forEach((result, testName) => {
      console.log(`\n${testName}:`);
      console.log(
        `  Status:            ${result.success ? "✅ Passed" : "❌ Failed"}`
      );
      console.log(`  Messages Sent:     ${result.messagesSent}`);
      console.log(`  Messages Received: ${result.messagesReceived}`);
      console.log(
        `  Duration:          ${result.endTime - result.startTime}ms`
      );
      if (result.error) {
        console.log(`  Error:             ${result.error.message}`);
      }
    });
    console.log("\n========================================");

    if (!testResult.success) {
      throw testResult.error;
    }
  } catch (error) {
    Logger.error("Test", "Test failed", { error });
    console.error("\n❌ Error details:", error);
    process.exit(1);
  } finally {
    await runner.cleanup();
    Logger.info("Test", "Test cleanup completed");
    // Exit with appropriate status code
    process.exit(testResult?.success ? 0 : 1);
  }
}
