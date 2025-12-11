
export interface GlobalConfig {
  apiKey: string
  organization: string
}

/**
 * This class is designed to provide a consistent API similar to the 'conf' package,
 * but it specifically handles configuration set directly (in this case environment variables)
 */
class EnvironmentVariableConfig {
  constructor(private config: GlobalConfig) {}

  get(key: keyof GlobalConfig) {
    return this.config[key]
  }

  set(key: string, value: string) {
    throw new Error('set undefined')
  }
}

const defaultConfig: GlobalConfig = {
  apiKey: "local-insecure-key",
  organization: "local",
}

class SimpleConfig {
  private config: GlobalConfig

  constructor(initial: GlobalConfig) {
    this.config = { ...initial }
  }

  get(key: keyof GlobalConfig) {
    return this.config[key]
  }

  set(key: keyof GlobalConfig, value: string) {
    this.config[key] = value
  }
}

export const getConfig = async () => {
  // Local-only mode: always return default values.
  return new SimpleConfig(defaultConfig)
}
