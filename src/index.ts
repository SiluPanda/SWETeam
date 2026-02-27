import { SWETeam } from "./main.js";

async function main() {
  const team = new SWETeam();

  process.on("SIGINT", () => team.shutdown());
  process.on("SIGTERM", () => team.shutdown());

  try {
    await team.run();
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

main();
