import { deleteSession, getSession, listSessions } from "../session/manager.js";

export async function handleDelete(sessionId: string): Promise<void> {
  if (sessionId === "--all" || sessionId === "-all") {
    const all = listSessions();
    if (all.length === 0) {
      console.log("No sessions to delete.");
      return;
    }
    for (const s of all) {
      deleteSession(s.id);
    }
    console.log(`Deleted all ${all.length} sessions.`);
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  deleteSession(sessionId);
  console.log(`Session ${sessionId} deleted.`);
}
