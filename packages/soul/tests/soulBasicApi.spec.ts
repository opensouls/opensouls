import { beforeEach, describe, beforeAll, afterEach, it, expect, setDefaultTimeout } from "bun:test";
import { Actions, Events, Soul } from "../src/soul.ts";

const ORGANIZATION_SLUG = "local";
const API_KEY = "insecure-local-key";

function attachSoulLogging(soul: Soul) {
  soul.onError((error) => {
    console.error("[soul-test] onError", error);
  });

  soul.on(Events.newSoulEvent, (evt) => {
    console.log("[soul-test] newSoulEvent", {
      action: evt.action,
      content: evt.content,
      kind: evt._kind,
      metadata: evt._metadata,
    });
  });

  soul.on(Events.newInteractionRequest, (evt) => {
    console.log("[soul-test] newInteractionRequest", {
      action: evt.action,
      content: evt.content,
      streaming: evt._metadata?.streaming,
    });
  });

  soul.on(Actions.SAYS, (evt) => {
    evt.content()
      .then((content) => {
        console.log("[soul-test] says content", { action: evt.action, content, name: evt.name });
      })
      .catch((error) => {
        console.error("[soul-test] says content error", error);
      });
  });

  soul.waitForConnected().then(() => {
    console.log("[soul-test] connected");
  }).catch((error) => {
    console.error("[soul-test] waitForConnected error", error);
  });

  soul.waitForFirstSync().then(() => {
    console.log("[soul-test] first sync complete");
  }).catch((error) => {
    console.error("[soul-test] waitForFirstSync error", error);
  });
}

async function soulEvent(soul: Soul, event: string | string[], timeout = 10000): Promise<void> {
  const eventsToWaitFor = Array.isArray(event) ? event : [event]
  const label = eventsToWaitFor.join("|")

  const seen = new Promise<void>((resolve) => {
    for (const evt of eventsToWaitFor) {
      soul.once(evt, () => {
        console.log(`[soul-test] observed event "${evt}"`)
        resolve()
      })
    }
  })

  await Promise.race([
    seen,
    new Promise((_, reject) => setTimeout(() => {
      console.error("[soul-test] timeout waiting for event", {
        label,
        eventsInStore: soul.events.map((e: any) => ({ action: e.action, content: e.content })),
      })
      reject(new Error("Timeout"))
    }, timeout))
  ]);
}

async function waitForActionInStore(soul: Soul, action: string, timeout = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    let events: any[] | undefined
    try {
      events = soul.events
    } catch (error) {
      console.warn("[soul-test] events getter threw, retrying", error)
    }

    const found = events?.find((evt: any) => evt.action === action)
    if (found) {
      console.log("[soul-test] observed action in store", { action, content: found.content })
      return found
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  console.error("[soul-test] timeout waiting for action in store", {
    action,
    eventsInStore: soul.events.map((e: any) => ({ action: e.action, content: e.content })),
  })
  throw new Error(`Timeout waiting for action ${action}`)
}

setDefaultTimeout(30_000)

describe("Soul basic API tests", () => {
  let cleanup: (() => any)[] = []

  beforeAll(() => {
    console.log("make sure you have run bunx soul-engine dev -l in the tests/shared/soul-package-test-soul directory")
    
    // using default local org/key; no env required
  })

  beforeEach(() => {
    cleanup = []
  })

  afterEach(async () => {
    for (const cleanupFunc of cleanup) {
      await cleanupFunc()
    }
  })

  it("resets the soul", async () => {
    const soul = new Soul({
      blueprint: "soul-package-test-soul",
      organization: ORGANIZATION_SLUG,
      token: API_KEY,
      debug: true,
      local: true,
    })
    attachSoulLogging(soul)

    await soul.connect()
    cleanup.push(() => soul.disconnect())

    await soul.waitForConnected()
    await soul.waitForFirstSync()

    console.log("[soul-test] dispatch addThought")
    await soul.dispatch({
      name: "friend",
      action: "addThought",
      content: "i would love to eat a big plate of tartiflette right now"
    })

    console.log("[soul-test] waiting for addedThought")
    await waitForActionInStore(soul, "addedThought");

    console.log("[soul-test] dispatch answerQuestion #1")
    await soul.dispatch({
      name: "friend",
      action: "answerQuestion",
      content: "hey, what do you want to eat?"
    })

    console.log("[soul-test] waiting for says #1")
    await waitForActionInStore(soul, "says");

    const saidBeforeReset = soul.events.find((event: any) => event.action === "says")
    console.log("[soul-test] saidBeforeReset", saidBeforeReset)
    expect(saidBeforeReset).toBeDefined()

    expect(saidBeforeReset?.content.toLowerCase()).toContain("tartiflette")

    console.log("[soul-test] sending reset")
    await soul.reset()

    // might take more than 5s, retry if fail
    console.log("[soul-test] waiting after reset")
    await new Promise((resolve) => setTimeout(resolve, 5000))

    console.log("[soul-test] dispatch answerQuestion #2")
    await soul.dispatch({
      name: "friend",
      action: "answerQuestion",
      content: "hey, what do you want to eat?"
    })

    console.log("[soul-test] waiting for says #2")
    await waitForActionInStore(soul, "says");

    const saidAfterReset = soul.events.find((event: any) => event.action === "says")
    console.log("[soul-test] saidAfterReset", saidAfterReset)
    expect(saidAfterReset).toBeDefined()

    expect(saidAfterReset?.content.toLowerCase()).not.toContain("tartiflette")
  })

})