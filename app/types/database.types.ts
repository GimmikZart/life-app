export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar: string | null
          preferences: Json
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar?: string | null
          preferences?: Json
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar?: string | null
          preferences?: Json
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
