import { Soul, load } from "@opensouls/engine";

const soul: Soul = {
  name: "SamanthaSimple",
  staticMemories: {
    core: load("./staticMemories/core.md")
  }
}

export default soul
