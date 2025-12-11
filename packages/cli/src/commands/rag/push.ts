import { getConfig } from '../../config.ts'
import { handleLogin } from '../../login.ts'
import { RagPoster } from '../../rag/rag-file-poster.ts'
import { Command } from "commander"

const createRagPushCommand = (program:Command) => {
  program
    .command('push <path>')
    .description('Push your RAG files to your SOUL ENGINE bucket.')
    .action(async (ragPath) => {
      await handleLogin()
      const globalConfig = await getConfig()
  
      const organization = globalConfig.get("organization")
      if (!organization) {
        throw new Error("missing organization, even after login")
      }
      
      const defaultRagDir = ragPath.join(".", "rag")
  
      const ragDir = ragPath || defaultRagDir
  
      const poster = RagPoster.createWithDefaultConfig({
        path: ragDir,
        organization,
        local: true,
        apiKey: globalConfig.get("apiKey"),
      })
  
      try {
        await poster.push()  
      } catch (error) {
        console.error("there was an error posting your RAG files:", error)
        throw error
      }
    })

}

export default createRagPushCommand