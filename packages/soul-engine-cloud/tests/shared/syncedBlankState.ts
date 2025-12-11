import { v4 as uuidv4 } from 'uuid'
import { SubroutineState, subroutineStateShape } from '../../src/subroutineState.ts'
import syncedStore from '../../src/forked-synced-store/index.ts'
import { SubroutineRunner } from '../../src/subroutineRunner.ts'
import { SoulCompartment } from '../../src/code/soulCompartment.ts'
import { EventLog } from '../../src/eventLog.ts'

export const syncedBlankState = (compartment: SoulCompartment, sessionId: string) => {
  const stateDoc = syncedStore(subroutineStateShape)

  const blankState = SubroutineRunner.initialStateDocFromSubroutine(sessionId, compartment)
  Object.entries(blankState).forEach(([key, value]) => {
    (stateDoc.state as any)[key] = value
  })

  const state = stateDoc.state as SubroutineState
  return state
}