export type PluginType = "VST2" | "VST3" | "AAX" | "AU" | "CLAP"

export interface Plugin {
  name: string
  installPath: string
  type: PluginType
}
