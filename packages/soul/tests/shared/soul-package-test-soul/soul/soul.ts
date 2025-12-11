import { Soul, load } from "@opensouls/engine";

const soul: Soul = {
  name: "Soul",
  staticMemories: {
    core: load("./staticMemories/core.md")
  }
}

export default soul
