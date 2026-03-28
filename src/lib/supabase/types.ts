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
      brands: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          primary_color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          primary_color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          primary_color?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          name: string
          type: string
          default_capacity: number | null
          description_prompt: string | null
          default_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          default_capacity?: number | null
          description_prompt?: string | null
          default_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          default_capacity?: number | null
          description_prompt?: string | null
          default_metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          email: string
          name: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          title: string
          slug: string
          type: string
          brand_id: string
          description: string | null
          date: string
          end_date: string | null
          venue_name: string
          venue_address: string
          city: string
          cover_image_url: string | null
          capacity: number | null
          waitlist_enabled: boolean
          rsvp_deadline: string | null
          status: string
          created_by: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          type: string
          brand_id: string
          description?: string | null
          date: string
          end_date?: string | null
          venue_name: string
          venue_address: string
          city: string
          cover_image_url?: string | null
          capacity?: number | null
          waitlist_enabled?: boolean
          rsvp_deadline?: string | null
          status?: string
          created_by: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          type?: string
          brand_id?: string
          description?: string | null
          date?: string
          end_date?: string | null
          venue_name?: string
          venue_address?: string
          city?: string
          cover_image_url?: string | null
          capacity?: number | null
          waitlist_enabled?: boolean
          rsvp_deadline?: string | null
          status?: string
          created_by?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      rsvps: {
        Row: {
          id: string
          event_id: string
          name: string
          email: string
          phone: string | null
          status: string
          account_id: string | null
          checked_in: boolean
          checked_in_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          email: string
          phone?: string | null
          status?: string
          account_id?: string | null
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          email?: string
          phone?: string | null
          status?: string
          account_id?: string | null
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      agent_conversations: {
        Row: {
          id: string
          account_id: string
          messages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: Record<string, never>
  }
}

// ---------------------------------------------------------------------------
// Convenience type aliases
// ---------------------------------------------------------------------------

// brands
export type Brand = Database['public']['Tables']['brands']['Row']
export type BrandInsert = Database['public']['Tables']['brands']['Insert']
export type BrandUpdate = Database['public']['Tables']['brands']['Update']

// templates
export type Template = Database['public']['Tables']['templates']['Row']
export type TemplateInsert = Database['public']['Tables']['templates']['Insert']
export type TemplateUpdate = Database['public']['Tables']['templates']['Update']

// accounts
export type Account = Database['public']['Tables']['accounts']['Row']
export type AccountInsert = Database['public']['Tables']['accounts']['Insert']
export type AccountUpdate = Database['public']['Tables']['accounts']['Update']

// events
export type Event = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']

// rsvps
export type Rsvp = Database['public']['Tables']['rsvps']['Row']
export type RsvpInsert = Database['public']['Tables']['rsvps']['Insert']
export type RsvpUpdate = Database['public']['Tables']['rsvps']['Update']

// agent_conversations
export type AgentConversation = Database['public']['Tables']['agent_conversations']['Row']
export type AgentConversationInsert = Database['public']['Tables']['agent_conversations']['Insert']
export type AgentConversationUpdate = Database['public']['Tables']['agent_conversations']['Update']
