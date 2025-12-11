import "dotenv/config";
import { Soul } from "../src/soul.ts";


const soul = new Soul({
  blueprint: "soul-package-test-soul",
  soulId: "manual-tester",
  organization: "local",
  token: "local-insecure-key",
  debug: true,
  local: true,
})

soul.on('says', async (event) => {
  console.log('says', await event.content())
})

await soul.connect()

