import { Soul, load } from "@opensouls/engine"

const soul:Soul = {
  name: "Inty",
  attributes: {
    age: 100,
    love: "walks on beach",
  },
  staticMemories: {
    core: await load("./memories/core.md")
  }
}

export default soul
