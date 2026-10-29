export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      allocation_lines: {
        Row: {
          amount_minor: number
          campaign_id: string
          created_at: string
          id: string
          organization_id: number
          period_id: string
          snapshot_id: string
          vote_count: number
        }
        Insert: {
          amount_minor: number
          campaign_id: string
          created_at?: string
          id?: string
          organization_id: number
          period_id: string
          snapshot_id: string
          vote_count: number
        }
        Update: {
          amount_minor?: number
          campaign_id?: string
          created_at?: string
          id?: string
          organization_id?: number
          period_id?: string
          snapshot_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocation_lines_campaign_organization_fkey"
            columns: ["campaign_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "campaign_organizations"
            referencedColumns: ["campaign_id", "organization_id"]
          },
          {
            foreignKeyName: "allocation_lines_snapshot_fkey"
            columns: ["snapshot_id", "period_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "allocation_snapshots"
            referencedColumns: ["id", "period_id", "campaign_id"]
          },
        ]
      }
      allocation_snapshots: {
        Row: {
          allocated_minor: number
          allocation_model: string
          budget_minor: number
          campaign_id: string
          close_source: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          period_id: string
          revision: number
          rule_version: string
          state: string
          supersedes_snapshot_id: string | null
          total_valid_votes: number
          unallocated_minor: number
          zero_vote_resolution: string | null
        }
        Insert: {
          allocated_minor: number
          allocation_model: string
          budget_minor: number
          campaign_id: string
          close_source: string
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          period_id: string
          revision?: number
          rule_version?: string
          state: string
          supersedes_snapshot_id?: string | null
          total_valid_votes: number
          unallocated_minor: number
          zero_vote_resolution?: string | null
        }
        Update: {
          allocated_minor?: number
          allocation_model?: string
          budget_minor?: number
          campaign_id?: string
          close_source?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          period_id?: string
          revision?: number
          rule_version?: string
          state?: string
          supersedes_snapshot_id?: string | null
          total_valid_votes?: number
          unallocated_minor?: number
          zero_vote_resolution?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_snapshots_period_campaign_fkey"
            columns: ["period_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_periods"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "allocation_snapshots_supersedes_snapshot_id_fkey"
            columns: ["supersedes_snapshot_id"]
            isOneToOne: false
            referencedRelation: "allocation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_organizations: {
        Row: {
          campaign_id: string
          created_at: string
          display_order: number
          id: number
          organization_id: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          display_order: number
          id?: never
          organization_id: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          display_order?: number
          id?: never
          organization_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_organizations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_periods: {
        Row: {
          allocation_model: string
          allocation_rule_version: string
          budget_minor: number
          campaign_id: string
          close_local_time: string
          close_weekday: number
          closed_at: string | null
          closes_at: string
          created_at: string
          currency: string
          id: string
          opens_at: string
          period_cadence: string
          sequence_number: number
          status: string
          timezone: string
        }
        Insert: {
          allocation_model: string
          allocation_rule_version?: string
          budget_minor: number
          campaign_id: string
          close_local_time?: string
          close_weekday?: number
          closed_at?: string | null
          closes_at: string
          created_at?: string
          currency: string
          id?: string
          opens_at: string
          period_cadence?: string
          sequence_number: number
          status?: string
          timezone: string
        }
        Update: {
          allocation_model?: string
          allocation_rule_version?: string
          budget_minor?: number
          campaign_id?: string
          close_local_time?: string
          close_weekday?: number
          closed_at?: string | null
          closes_at?: string
          created_at?: string
          currency?: string
          id?: string
          opens_at?: string
          period_cadence?: string
          sequence_number?: number
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_periods_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          allocation_model: string
          budget_minor: number
          close_local_time: string
          close_weekday: number
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          period_cadence: string
          public_id: string
          published_at: string | null
          status: string
          summary: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          allocation_model?: string
          budget_minor: number
          close_local_time?: string
          close_weekday?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          period_cadence?: string
          public_id: string
          published_at?: string | null
          status?: string
          summary: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          allocation_model?: string
          budget_minor?: number
          close_local_time?: string
          close_weekday?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          period_cadence?: string
          public_id?: string
          published_at?: string | null
          status?: string
          summary?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          public_name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          public_name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          public_name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      donation_records: {
        Row: {
          allocation_line_id: string
          allocation_snapshot_id: string
          amount_minor: number
          campaign_id: string
          company_id: string
          created_at: string
          currency: string
          current_note: string | null
          environment: string
          evidence_reference: string | null
          id: string
          organization_id: number
          period_id: string
          status: string
          updated_at: string
        }
        Insert: {
          allocation_line_id: string
          allocation_snapshot_id: string
          amount_minor: number
          campaign_id: string
          company_id: string
          created_at?: string
          currency: string
          current_note?: string | null
          environment?: string
          evidence_reference?: string | null
          id?: string
          organization_id: number
          period_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          allocation_line_id?: string
          allocation_snapshot_id?: string
          amount_minor?: number
          campaign_id?: string
          company_id?: string
          created_at?: string
          currency?: string
          current_note?: string | null
          environment?: string
          evidence_reference?: string | null
          id?: string
          organization_id?: number
          period_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_records_allocation_line_fkey"
            columns: [
              "allocation_line_id",
              "allocation_snapshot_id",
              "campaign_id",
              "period_id",
              "organization_id",
            ]
            isOneToOne: false
            referencedRelation: "allocation_lines"
            referencedColumns: [
              "id",
              "snapshot_id",
              "campaign_id",
              "period_id",
              "organization_id",
            ]
          },
          {
            foreignKeyName: "donation_records_campaign_company_fkey"
            columns: ["campaign_id", "company_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      donation_status_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          donation_record_id: string
          evidence_reference: string | null
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          donation_record_id: string
          evidence_reference?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          donation_record_id?: string
          evidence_reference?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_status_events_donation_record_id_fkey"
            columns: ["donation_record_id"]
            isOneToOne: false
            referencedRelation: "donation_records"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_color: string
          category: string
          country_code: string
          created_at: string
          id: number
          is_active: boolean
          name: string
          short_description: string
          slug: string
          verification_state: string
          website_url: string | null
        }
        Insert: {
          brand_color?: string
          category: string
          country_code?: string
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
          short_description: string
          slug: string
          verification_state?: string
          website_url?: string | null
        }
        Update: {
          brand_color?: string
          category?: string
          country_code?: string
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
          short_description?: string
          slug?: string
          verification_state?: string
          website_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          invalid_reason: string | null
          is_valid: boolean
          organization_id: number
          period_id: string
          rate_limit_key_hash: string
          visitor_key_hash: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          invalid_reason?: string | null
          is_valid?: boolean
          organization_id: number
          period_id: string
          rate_limit_key_hash: string
          visitor_key_hash: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          invalid_reason?: string | null
          is_valid?: boolean
          organization_id?: number
          period_id?: string
          rate_limit_key_hash?: string
          visitor_key_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_campaign_organization_fkey"
            columns: ["campaign_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "campaign_organizations"
            referencedColumns: ["campaign_id", "organization_id"]
          },
          {
            foreignKeyName: "votes_period_campaign_fkey"
            columns: ["period_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_periods"
            referencedColumns: ["id", "campaign_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cast_vote: {
        Args: {
          p_organization_id: number
          p_public_id: string
          p_rate_limit_key_hash: string
          p_visitor_key_hash: string
        }
        Returns: Json
      }
      close_due_campaign_periods: { Args: { p_limit?: number }; Returns: Json }
      create_draft_campaign: {
        Args: {
          p_allocation_model: string
          p_budget_minor: number
          p_close_local_time: string
          p_close_weekday: number
          p_company_id: string
          p_currency: string
          p_organization_ids: number[]
          p_period_cadence: string
          p_summary: string
          p_timezone: string
          p_title: string
        }
        Returns: {
          allocation_model: string
          budget_minor: number
          close_local_time: string
          close_weekday: number
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          period_cadence: string
          public_id: string
          published_at: string | null
          status: string
          summary: string
          timezone: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_campaign_period_now: {
        Args: { p_period_id: string }
        Returns: Json
      }
      get_campaign_public_ledger: {
        Args: { p_public_id: string }
        Returns: {
          allocated_minor: number
          allocation_model: string
          allocation_state: string
          amount_minor: number
          budget_minor: number
          confirmed_paid_minor: number
          currency: string
          donation_status: string
          organization_id: number
          period_closed_at: string
          period_id: string
          period_sequence: number
          snapshot_id: string
          snapshot_revision: number
          total_valid_votes: number
          unallocated_minor: number
          vote_count: number
        }[]
      }
      get_campaign_vote_results: {
        Args: { p_public_id: string }
        Returns: {
          closes_at: string
          opens_at: string
          organization_id: number
          period_id: string
          period_status: string
          total_votes: number
          vote_count: number
        }[]
      }
      publish_campaign: {
        Args: { p_campaign_id: string }
        Returns: {
          allocation_model: string
          budget_minor: number
          close_local_time: string
          close_weekday: number
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          period_cadence: string
          public_id: string
          published_at: string | null
          status: string
          summary: string
          timezone: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_donation_status: {
        Args: {
          p_donation_record_id: string
          p_evidence_reference?: string
          p_note?: string
          p_status: string
        }
        Returns: Json
      }
      resolve_zero_vote_allocation: {
        Args: { p_resolution: string; p_snapshot_id: string }
        Returns: Json
      }
      update_draft_campaign: {
        Args: {
          p_allocation_model: string
          p_budget_minor: number
          p_campaign_id: string
          p_close_local_time: string
          p_close_weekday: number
          p_currency: string
          p_organization_ids: number[]
          p_period_cadence: string
          p_summary: string
          p_timezone: string
          p_title: string
        }
        Returns: {
          allocation_model: string
          budget_minor: number
          close_local_time: string
          close_weekday: number
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          period_cadence: string
          public_id: string
          published_at: string | null
          status: string
          summary: string
          timezone: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

export type TableRow<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];
