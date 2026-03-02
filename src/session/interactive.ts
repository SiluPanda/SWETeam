import { runChatLoop, getHelpText } from "./chat.js";
import { getSession, stopSession, addMessage } from "./manager.js";
import { invokePlanner } from "../planner/planner.js";
import { handleBuild } from "../orchestrator/build-handler.js";
import { handleFeedback } from "../orchestrator/feedback-handler.js";
import {
  getStatusDisplay,
  getPlanDisplay,
  getDiffDisplay,
  getPrDisplay,
  getTasksDisplay,
} from "./in-session-commands.js";

/**
 * Start an interactive session — wires the chat loop to all handlers.
 * Used by both /create (after session creation) and /enter (after showing summary).
 */
export async function startInteractiveSession(
  sessionId: string,
  repo: string,
  goal: string,
  repoPath: string,
): Promise<void> {
  // Track the last planner response so @build can use it
  let lastPlannerResponse = "";

  console.log("\nType a message to chat with the planner.");
  console.log("Type @build when the plan is ready, @help for commands.\n");

  await runChatLoop(sessionId, {
    onMessage: async (text: string): Promise<string> => {
      try {
        const response = await invokePlanner(sessionId, repo, goal, repoPath);
        lastPlannerResponse = response;
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Error invoking planner: ${msg}`;
      }
    },

    onBuild: async (): Promise<void> => {
      if (!lastPlannerResponse) {
        console.log(
          "No plan generated yet. Chat with the planner first, then type @build.",
        );
        return;
      }

      console.log("\nPlan finalized. Starting autonomous build...\n");
      try {
        await handleBuild(sessionId, lastPlannerResponse);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Build failed: ${msg}`);
        addMessage(sessionId, "system", `Build failed: ${msg}`);
      }
    },

    onStop: async (): Promise<void> => {
      stopSession(sessionId);
      console.log(`\nSession ${sessionId} stopped.\n`);
    },

    onFeedback: async (text: string): Promise<void> => {
      console.log("\nProcessing feedback...\n");
      try {
        await handleFeedback(sessionId, text);
        console.log("Feedback iteration complete. PR updated.\n");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Feedback processing failed: ${msg}`);
        addMessage(sessionId, "system", `Feedback failed: ${msg}`);
      }
    },

    onPlan: async (): Promise<string | null> => {
      return getPlanDisplay(sessionId);
    },

    onStatus: async (): Promise<string> => {
      return getStatusDisplay(sessionId);
    },

    onDiff: async (): Promise<string> => {
      return getDiffDisplay(sessionId);
    },

    onPr: async (): Promise<string> => {
      return getPrDisplay(sessionId);
    },

    onTasks: async (): Promise<string> => {
      return getTasksDisplay(sessionId);
    },
  });
}
