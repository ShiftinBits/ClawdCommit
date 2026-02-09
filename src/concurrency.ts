import type * as vscode from 'vscode';

class Semaphore {
    private count: number;
    private readonly queue: Array<() => void> = [];

    constructor(max: number) {
        this.count = max;
    }

    acquire(): Promise<void> {
        if (this.count > 0) {
            this.count--;
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            this.queue.push(resolve);
        });
    }

    release(): void {
        this.count++;
        const next = this.queue.shift();
        if (next) {
            this.count--;
            next();
        }
    }
}

/**
 * Execute an async function over an array of items with bounded concurrency.
 *
 * Results are returned in the same order as the input items.
 * Items that fail or are skipped due to cancellation resolve to null.
 */
export async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R | null>,
    token: vscode.CancellationToken
): Promise<Array<R | null>> {
    const sem = new Semaphore(concurrency);

    const tasks = items.map(async (item, index): Promise<R | null> => {
        if (token.isCancellationRequested) {
            return null;
        }

        await sem.acquire();

        if (token.isCancellationRequested) {
            sem.release();
            return null;
        }

        try {
            return await fn(item, index);
        } catch (error) {
            console.error(`[ClawdCommit] Concurrent task ${index} failed:`, error);
            return null;
        } finally {
            sem.release();
        }
    });

    return Promise.all(tasks);
}
