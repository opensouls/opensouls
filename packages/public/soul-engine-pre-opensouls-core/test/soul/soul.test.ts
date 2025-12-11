/* eslint-disable camelcase */
import { createClient } from "@supabase/supabase-js"
import { expect } from "chai"
import crypto from "node:crypto"
import fs, { PathLike } from "node:fs"
import path from "node:path"
import { v4 as uuidv4 } from 'uuid';

import { Actions, Soul, SoulEvents, said } from "../../src/soul/soul.ts"

const SUPABASE_URL="http://127.0.0.1:54321"
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function readDirRecursive(directory: PathLike) {
  let results:string[] = [];
  const list = fs.readdirSync(directory);
  for (const listFile of list) {
    const file = path.join(directory.toString(), listFile);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = [...results, ...readDirRecursive(file)];
    } else {
      /* Is a file */
      results.push(file);
    }
  }

  return results;
}

describe("Soul", () => {
  let userId: string | undefined
  let orgId = uuidv4()
  const orgSlug = "soul-server-test"
  const blueprintName = "samantha-learns"
  let apiKey: string | undefined

  const email = "test-user@nonsense.com"
  const password = "password"

  beforeEach(async () => {
    const anonSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { error } = await anonSupabase.auth.signUp({
      email,
      password,
    })
    if (error?.message.startsWith("User already registered")) {
      await anonSupabase.auth.signInWithPassword({
        email,
        password,
      })
    }

    const { data: { user } } = await anonSupabase.auth.getUser()
    userId = user?.id
    if (!userId) {
      throw new Error("missing user id")
    }

    const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    {
      const { data }= await serviceSupabase.from("organizations").select("*").eq("slug", orgSlug).maybeSingle()
      if (data) {
        orgId = data.id
      } else {
        const { error } = await serviceSupabase.from("organizations").upsert({
          id: orgId,
          name: "soul-server-test org",
          slug: orgSlug,
        })
        if (error) {
          throw error
        }
      }
    }

    {
      const { error } = await serviceSupabase.from("memberships").upsert({
        user_id: userId,
        organization_id: orgId,
      })
      if ( error ) {
        throw error
      }
    }


    apiKey = uuidv4()
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  
    {
      const { error } = await anonSupabase.from("api_keys").insert({
        id: uuidv4(),
        user_id: userId,
        organization_id: orgId,
        key_hash: `\\x${keyHash}`,
      })
      if ( error ) {
        throw error
      }
    }

    const pathToSamantha = `../../souls/${blueprintName}/src`
    const files = readDirRecursive(pathToSamantha).map((filePath) => {
      const relativePath = path.relative(pathToSamantha, filePath)
      return {
        content: fs.readFileSync(filePath, "utf8"),
        relativePath,
      }
    })
    console.log(files.map((file) => "up: " + file.relativePath))

    await new Promise<void>((resolve) => { setTimeout(resolve, 1000) })

    const response = await fetch(`http://localhost:4000/api/${orgSlug}/write-files/${blueprintName}`, {
      body: JSON.stringify({ files }),
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST",
    })
    console.log("response", response?.status, response?.statusText)
  })

  it("interfaces correctly with the engine", async () => {
    let soul: Soul | undefined
    let newSoul: Soul | undefined

    try {

      soul = new Soul({
        local: true,
        organization: orgSlug,
        blueprint: blueprintName,
      })
  
      await soul.connect()
  
      const thingsSaid: string[] = []
  
      const onSays: SoulEvents[Actions.SAYS] = async (evt) => {    
        console.log("onSays", evt.content())
        thingsSaid.push(await evt.content())
      }
  
      soul.on(Actions.SAYS, onSays)
  
      await soul.dispatch(said("Interluctor", "hello world"))
  
      await new Promise((resolve) => {
        setTimeout(resolve, 4000)
      })
  
      expect(soul.events).to.have.lengthOf(5)
      expect(thingsSaid).to.have.lengthOf(1)
      expect(soul.events[2].content).to.equal(thingsSaid[0])
  
      await soul.dispatch(said("Interlocutor", "I'm ready"))
      await new Promise((resolve) => {
        setTimeout(resolve, 2000)
      })
  
      expect(soul.events).to.have.length.greaterThanOrEqual(6).and.lessThanOrEqual(12)
  
      await soul.disconnect()
  
      newSoul = new Soul({
        local: true,
        organization: orgSlug,
        soulId: soul.soulId,
        blueprint: blueprintName,
      })
  

      await newSoul.connect()
  
      await new Promise((resolve) => {
        setTimeout(resolve, 1000)
      })
  
      expect(newSoul.events).to.have.lengthOf(soul.events.length)
  
      await newSoul.disconnect()
    } finally {
      await soul?.disconnect()
      await newSoul?.disconnect()
    }
  })

  it("streams in the content", async () => {
    let soul: Soul | undefined
    try {
      soul = new Soul({
        local: true,
        organization: orgSlug,
        blueprint: blueprintName,
      })
  
      await soul.connect()
  
      const thingsSaid: string[] = []
      const streamsSent: string[][] = []
  
      let resolver: () => void
  
      const waitForFirstMessage = new Promise<void>((resolve) => {
        resolver = resolve
      })
  
      const onSays: SoulEvents[Actions.SAYS] = async (evt) => {
        const stream: string[] = []
        streamsSent.push(stream)
        for await (const message of evt.stream()) {
          stream.push(message)
        }
  
        thingsSaid.push(await evt.content())
        resolver()
      }
  
      soul.on(Actions.SAYS, onSays)
  
      await soul.dispatch(said("Interluctor", "hello streaming fans!"))
  
      await waitForFirstMessage
  
      expect(soul.events).to.have.lengthOf(3)
      
      expect(streamsSent).to.have.lengthOf(1)
      expect(streamsSent[0]).to.have.length.greaterThan(1)
      expect(streamsSent[0].join("")).to.equal(thingsSaid[0])
    } finally {
      soul?.disconnect()
    }
  })

  it('supports connecting to a debug chat', async () => {
    let soul: Soul | undefined
    try {
      soul = new Soul({
        local: true,
        organization: orgSlug,
        blueprint: blueprintName,
        debug: true,
        token: apiKey,
      })
  
      await soul.connect()
  
      const thingsSaid: string[] = []
      const streamsSent: string[][] = []
  
      let resolver: () => void
  
      const waitForFirstMessage = new Promise<void>((resolve) => {
        resolver = resolve
      })
  
      const onSays: SoulEvents[Actions.SAYS] = async (evt) => {
        const stream: string[] = []
        streamsSent.push(stream)
        for await (const message of evt.stream()) {
          stream.push(message)
        }
  
        thingsSaid.push(await evt.content())
        resolver()
      }
  
      soul.on(Actions.SAYS, onSays)
  
      await soul.dispatch(said("Interluctor", "hello streaming fans!"))
  
      await waitForFirstMessage
  
      expect(soul.events).to.have.lengthOf(3)
      
      expect(streamsSent).to.have.lengthOf(1)
      expect(streamsSent[0]).to.have.length.greaterThan(1)
      expect(streamsSent[0].join("")).to.equal(thingsSaid[0])
    } finally {
      soul?.disconnect()
    }
  })

})