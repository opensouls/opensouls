import { EventEmitter } from "node:events";

/**
 * The point of this class is that it can work on our current single server setup, but be extended to handle multiple servers over a message queue
 * 
 */
class GlobalAbortController extends EventEmitter {

  constructor() {
    super()
  }

  abort(docName: string) {
    this.emit(`abort:${docName}`)
  }

  onAbort(docName: string, callback: () => void) {
    const remover = () => {
      this.off(`abort:${docName}`, callback)
    }
    this.on(`abort:${docName}`, callback)
    
    return remover
  }

}

export default GlobalAbortController
