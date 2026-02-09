import { mapWithConcurrency } from '../concurrency';
import { createMockCancellationToken } from './helpers/mockCancellationToken';

describe('mapWithConcurrency', () => {
    it('returns an empty array when given empty items', async () => {
        const token = createMockCancellationToken();
        const result = await mapWithConcurrency([], 3, async () => 'value', token);
        expect(result).toEqual([]);
    });

    it('returns [result] for a single item that succeeds', async () => {
        const token = createMockCancellationToken();
        const result = await mapWithConcurrency(
            ['hello'],
            2,
            async (item) => item.toUpperCase(),
            token
        );
        expect(result).toEqual(['HELLO']);
    });

    it('returns results in input order when multiple items all succeed', async () => {
        const token = createMockCancellationToken();
        const items = [1, 2, 3, 4, 5];
        const result = await mapWithConcurrency(
            items,
            3,
            async (item) => item * 10,
            token
        );
        expect(result).toEqual([10, 20, 30, 40, 50]);
    });

    it('respects the concurrency limit', async () => {
        const token = createMockCancellationToken();
        let currentConcurrent = 0;
        let maxConcurrent = 0;

        const result = await mapWithConcurrency(
            [1, 2, 3, 4, 5],
            2,
            async (item) => {
                currentConcurrent++;
                maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
                await new Promise((resolve) => setTimeout(resolve, 10));
                currentConcurrent--;
                return item;
            },
            token
        );

        expect(maxConcurrent).toBe(2);
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('executes serially when concurrency is 1', async () => {
        const token = createMockCancellationToken();
        let currentConcurrent = 0;
        let maxConcurrent = 0;

        await mapWithConcurrency(
            [1, 2, 3],
            1,
            async (item) => {
                currentConcurrent++;
                maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
                await new Promise((resolve) => setTimeout(resolve, 10));
                currentConcurrent--;
                return item;
            },
            token
        );

        expect(maxConcurrent).toBe(1);
    });

    it('returns null for a task that throws, leaving other results unaffected', async () => {
        const token = createMockCancellationToken();
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const result = await mapWithConcurrency(
            ['a', 'b', 'c'],
            3,
            async (item, index) => {
                if (index === 1) {
                    throw new Error('task failed');
                }
                return item.toUpperCase();
            },
            token
        );

        expect(result).toEqual(['A', null, 'C']);
        consoleSpy.mockRestore();
    });

    it('returns all nulls when the token is cancelled before execution', async () => {
        const token = createMockCancellationToken();
        token.cancel();

        const fn = jest.fn(async (item: number) => item);
        const result = await mapWithConcurrency([1, 2, 3], 2, fn, token);

        expect(result).toEqual([null, null, null]);
        expect(fn).not.toHaveBeenCalled();
    });

    it('returns results for completed items and null for the rest when cancelled mid-execution', async () => {
        const token = createMockCancellationToken();
        const callOrder: number[] = [];

        const result = await mapWithConcurrency(
            [1, 2, 3, 4, 5],
            1,
            async (item, index) => {
                callOrder.push(index);
                await new Promise((resolve) => setTimeout(resolve, 5));
                const value = item * 10;
                if (index === 1) {
                    token.cancel();
                }
                return value;
            },
            token
        );

        // Items 0 and 1 completed; remaining items should be null
        expect(result[0]).toBe(10);
        expect(result[1]).toBe(20);
        for (let i = 2; i < result.length; i++) {
            expect(result[i]).toBeNull();
        }
    });

    it('passes correct (item, index) arguments to the fn', async () => {
        const token = createMockCancellationToken();
        const fn = jest.fn(async (item: string, index: number) => `${item}-${index}`);

        const items = ['a', 'b', 'c'];
        await mapWithConcurrency(items, 3, fn, token);

        expect(fn).toHaveBeenCalledTimes(3);
        expect(fn).toHaveBeenCalledWith('a', 0);
        expect(fn).toHaveBeenCalledWith('b', 1);
        expect(fn).toHaveBeenCalledWith('c', 2);
    });

    it('preserves input order even when tasks complete in different order', async () => {
        const token = createMockCancellationToken();
        // Delays: item 0 slowest, item 4 fastest
        const delays = [40, 30, 20, 10, 5];

        const result = await mapWithConcurrency(
            delays,
            5,
            async (delay, index) => {
                await new Promise((resolve) => setTimeout(resolve, delay));
                return index;
            },
            token
        );

        expect(result).toEqual([0, 1, 2, 3, 4]);
    });
});
