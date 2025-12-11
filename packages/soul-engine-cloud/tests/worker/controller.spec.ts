import { expect, it, describe, beforeEach, afterEach } from "bun:test";
import { WorkerController } from "../../src/worker/controller.ts";

// this is just a super basic test, a lot of the other functionality is covered in the larger integration tests.

describe("WorkerController", () => {
  let controller: WorkerController;

  beforeEach(() => {
    controller = new WorkerController();
  });

  afterEach(() => {
    controller.kill();
  });

  it("spins up a controller, waits for it to be alive, and then shuts down", async () => {
    await controller.spawn();
    await controller.waitForAlive();
    
    expect(controller.isAlive).toBe(true);

    controller.kill();
    
    expect(controller.isAlive).toBe(false);
  });
});
