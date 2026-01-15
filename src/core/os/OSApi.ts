export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface OSApi {
  readDir(path: string): Promise<DirEntry[]>
  pathExists(path: string): Promise<boolean>
}