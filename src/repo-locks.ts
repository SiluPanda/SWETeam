import { Mutex } from "async-mutex";

export class RepoLockManager {
  private locks = new Map<string, Mutex>();

  get(repoName: string): Mutex {
    if (!this.locks.has(repoName)) this.locks.set(repoName, new Mutex());
    return this.locks.get(repoName)!;
  }
}
