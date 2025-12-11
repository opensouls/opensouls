import { expect, it, describe, beforeEach, afterEach } from "bun:test";
import { Pool, PoolOptions } from "../../src/worker/pool.ts";

describe("Pool", () => {
  let pool: Pool<number>;
  let counter = 0;

  beforeEach(() => {
    counter = 0;
    const options: PoolOptions<number> = {
      create: async () => ++counter,
      destroy: async () => {},
      validate: async () => true,
      min: 1,
      max: 3,
    };

    pool = new Pool(options);
  });

  afterEach(async () => {
    await pool.drain();
  });

  it("creates minimum number of objects on initialization", async () => {
    await new Promise(resolve => setTimeout(resolve, 10)); // Allow time for initialization
    expect(pool.size.available).toBe(1);
    expect(counter).toBe(1);
  });

  it("acquires an object from the pool", async () => {
    const item = await pool.acquire();
    expect(item).toBe(1);
    expect(pool.size.inUse).toBe(1);
    expect(pool.size.available).toBe(0);
  });

  it("releases an object back to the pool", async () => {
    const item = await pool.acquire();
    await pool.release(item);
    expect(pool.size.inUse).toBe(0);
    expect(pool.size.available).toBe(1);
  });

  it("creates new object when pool is empty", async () => {
    await pool.acquire();
    const secondItem = await pool.acquire();
    expect(secondItem).toBe(2);
    expect(counter).toBe(2);
  });

  it("does not exceed maximum pool size", async () => {
    const acquisitions = await Promise.all([
      pool.acquire(),
      pool.acquire(),
      pool.acquire(),
    ]);
    expect(counter).toBe(3);
    expect(pool.size.inUse).toBe(3);
    expect(pool.size.available).toBe(0);
    const fourthAcquisition = pool.acquire();
    // // the above will hang until we release one of the items
    await pool.release(acquisitions[0]);
    return fourthAcquisition
  });

  it("validates object before returning to pool", async () => {
    const item = await pool.acquire();
    await pool.release(item);
    expect(pool.size.available).toBe(1);
  });

  it("handles invalid objects", async () => {
    // make every other object invalid, but check that 
    // all items in use are actually valid.
    let validationCounter = 0;
    const customPool = new Pool<{ id: number, isValid: boolean }>({
      create: async () => {
        validationCounter++;
        const isValid = validationCounter % 2 === 0;
        return {
          id: validationCounter,
          isValid
        }
      },
      destroy: async () => {},
      validate: async (item) => {
        return item.isValid;
      },
      min: 1,
      max: 4,
    });

    // we'll create and return 8 items
    const itemPromises = Array(8).fill(0).map(() => customPool.acquire());

    // first we'll max out our acquisitions
    const firstRoundAcquired = await Promise.all(itemPromises.slice(0,4));

    for (const item of firstRoundAcquired) {
      expect(item.isValid).toBe(true);
      await customPool.release(item);
    }

    // now we'll acquire the next 4 items
    const secondRoundAcquired = await Promise.all(itemPromises.slice(4));
    for (const item of secondRoundAcquired) {
      expect(item.isValid).toBe(true);
      await customPool.release(item);
    }
    
    expect(customPool.size.inUse).toBe(0);

    expect(customPool.size.available).toBe(4);
  });

  it("drains the pool", async () => {
    await pool.acquire();
    await pool.acquire();
    await pool.drain();
    expect(pool.size.inUse).toBe(0);
    expect(pool.size.available).toBe(0);
  });
});
