import { describe, it } from "bun:test"
import { HonoWithSockets } from "../../src/server/honoWithSockets.ts"


describe("honoWithSockets", () => {
  const port = 4002

  it('wraps', async () => {
    
    const server = new HonoWithSockets()
    server.api.get("/:organizationSlug/debug-chat", async (c) => {

      return server.ws(c, {organizationSlug: c.req.param("organizationSlug")}, (ws) => {
        // do stuff with a websocket
        ws.on("open", async () => {
          // console.log("opened in the handler: ", ws)
          ws.ping()
          ws.send("hi")
        })
      })
    })
    server.listen(port)

    let resolve: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    const socket = new WebSocket(`ws://localhost:${port}/hi/debug-chat`)
    socket.onopen = () => {
      console.log("opened")
    }
    socket.onmessage = (e) => {
      resolve()
      console.log("message", e.data)
    }

    await promise
    server.stop()
  })
})
