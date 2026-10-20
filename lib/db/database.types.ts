
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "analytics_events": {
                  Row: {
                    "created_at": string,"event": string,"id": number,"props": NonNullable<Json>,"team_ref": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event": string,"id"?: never,"props"?: NonNullable<Json>,"team_ref": string
                  }
                  Update: {
                    "created_at"?: string,"event"?: string,"id"?: never,"props"?: NonNullable<Json>,"team_ref"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_id": string,"created_at": string,"id": string,"resource_id": string,"resource_type": string,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string,"created_at"?: string,"id"?: string,"resource_id": string,"resource_type": string,"team_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"created_at"?: string,"id"?: string,"resource_id"?: string,"resource_type"?: string,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"lineup_assignments": {
                  Row: {
                    "formation_slot": number | null,"plan_id": string,"player_id": string,"position_label": string | null,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "formation_slot"?: number | null,"plan_id": string,"player_id": string,"position_label"?: string | null,"role": string
                  }
                  Update: {
                    "formation_slot"?: number | null,"plan_id"?: string,"player_id"?: string,"position_label"?: string | null,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lineup_assignments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "match_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lineup_assignments_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"match_plans": {
                  Row: {
                    "draft_status": string,"id": string,"match_id": string,"objective": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "draft_status"?: string,"id"?: string,"match_id": string,"objective"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "draft_status"?: string,"id"?: string,"match_id"?: string,"objective"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_plans_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "created_at": string,"id": string,"kickoff_at": string,"kickoff_tz": string,"match_format": number,"opponent_name": string,"status": string,"team_id": string,"updated_at": string,"venue": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kickoff_at": string,"kickoff_tz": string,"match_format": number,"opponent_name": string,"status"?: string,"team_id": string,"updated_at"?: string,"venue"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kickoff_at"?: string,"kickoff_tz"?: string,"match_format"?: number,"opponent_name"?: string,"status"?: string,"team_id"?: string,"updated_at"?: string,"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_sections": {
                  Row: {
                    "content_json": NonNullable<Json>,"id": string,"include_in_briefing": boolean,"plan_id": string,"section_type": string,"sort_order": number,"tactic_id": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_json"?: NonNullable<Json>,"id"?: string,"include_in_briefing"?: boolean,"plan_id": string,"section_type": string,"sort_order": number,"tactic_id"?: string | null,"title": string
                  }
                  Update: {
                    "content_json"?: NonNullable<Json>,"id"?: string,"include_in_briefing"?: boolean,"plan_id"?: string,"section_type"?: string,"sort_order"?: number,"tactic_id"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_sections_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "match_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_sections_tactic_id_fkey"
      columns: ["tactic_id"]
isOneToOne: false
      referencedRelation: "tactics"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"preferred_positions": (string)[],"shirt_number": number | null,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"preferred_positions"?: (string)[],"shirt_number"?: number | null,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"preferred_positions"?: (string)[],"shirt_number"?: number | null,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "players_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"published_plans": {
                  Row: {
                    "id": string,"plan_id": string,"published_at": string,"published_by": string,"revoked_at": string | null,"share_token_hash": string,"slide_count": number,"snapshot_json": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"plan_id": string,"published_at"?: string,"published_by"?: string,"revoked_at"?: string | null,"share_token_hash": string,"slide_count": number,"snapshot_json": NonNullable<Json>
                  }
                  Update: {
                    "id"?: string,"plan_id"?: string,"published_at"?: string,"published_by"?: string,"revoked_at"?: string | null,"share_token_hash"?: string,"slide_count"?: number,"snapshot_json"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "published_plans_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "match_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"share_lookup_counters": {
                  Row: {
                    "client_hash": string,"hits": number,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_hash": string,"hits"?: number,"window_start": string
                  }
                  Update: {
                    "client_hash"?: string,"hits"?: number,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tactics": {
                  Row: {
                    "board_json": NonNullable<Json>,"board_schema_version": number,"category": string,"created_at": string,"format": number,"id": string,"name": string,"team_id": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "board_json": NonNullable<Json>,"board_schema_version"?: number,"category"?: string,"created_at"?: string,"format": number,"id"?: string,"name": string,"team_id": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "board_json"?: NonNullable<Json>,"board_schema_version"?: number,"category"?: string,"created_at"?: string,"format"?: number,"id"?: string,"name"?: string,"team_id"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tactics_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "analytics_id": string,"created_at": string,"id": string,"match_format": number,"name": string,"owner_id": string,"primary_color": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analytics_id"?: string,"created_at"?: string,"id"?: string,"match_format": number,"name": string,"owner_id"?: string,"primary_color"?: string,"updated_at"?: string
                  }
                  Update: {
                    "analytics_id"?: string,"created_at"?: string,"id"?: string,"match_format"?: number,"name"?: string,"owner_id"?: string,"primary_color"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "analytics_props_ok":
{ Args: { "p_event": string,"p_props": Json }; Returns: boolean
                           },
"get_published_snapshot":
{ Args: { "p_client_hash": string,"p_purpose"?: string,"p_token": string }; Returns: Json
                           },
"is_match_owner":
{ Args: { "p_match_id": string }; Returns: boolean
                           },
"is_plan_owner":
{ Args: { "p_plan_id": string }; Returns: boolean
                           },
"is_team_owner":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"move_plan_section":
{ Args: { "p_delta": number,"p_section_id": string }; Returns: undefined
                           },
"plan_context":
{ Args: { "p_plan_id": string }; Returns: Record<string, unknown>
                           },
"save_lineup":
{ Args: { "p_lineup": Json,"p_plan_id": string }; Returns: undefined
                           },
"track_event":
{ Args: { "p_event": string,"p_props"?: Json,"p_team_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
