export type PluginType = "VST2" | "VST3" | "AAX"

export interface Plugin {
  name: string
  installPath: string
  type: PluginType
}
