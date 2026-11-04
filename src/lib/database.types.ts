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
      campaign_funding_orders: {
        Row: {
          allocation_snapshot_id: string
          approved_at: string | null
          attempt_count: number
          campaign_id: string
          company_id: string
          completed_at: string | null
          created_at: string
          currency: string
          environment: string
          id: string
          initiated_by: string | null
          last_error_code: string | null
          paypal_order_id: string | null
          period_id: string
          provider_debug_id: string | null
          provider_status: string | null
          request_id: string
          status: string
          total_minor: number
          updated_at: string
        }
        Insert: {
          allocation_snapshot_id: string
          approved_at?: string | null
          attempt_count?: number
          campaign_id: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          currency: string
          environment?: string
          id?: string
          initiated_by?: string | null
          last_error_code?: string | null
          paypal_order_id?: string | null
          period_id: string
          provider_debug_id?: string | null
          provider_status?: string | null
          request_id: string
          status?: string
          total_minor: number
          updated_at?: string
        }
        Update: {
          allocation_snapshot_id?: string
          approved_at?: string | null
          attempt_count?: number
          campaign_id?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          initiated_by?: string | null
          last_error_code?: string | null
          paypal_order_id?: string | null
          period_id?: string
          provider_debug_id?: string | null
          provider_status?: string | null
          request_id?: string
          status?: string
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_funding_orders_campaign_company_fkey"
            columns: ["campaign_id", "company_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "campaign_funding_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_funding_orders_snapshot_fkey"
            columns: ["allocation_snapshot_id", "period_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "allocation_snapshots"
            referencedColumns: ["id", "period_id", "campaign_id"]
          },
        ]
      }
      campaign_funding_units: {
        Row: {
          amount_minor: number
          completed_at: string | null
          created_at: string
          currency: string
          donation_record_id: string
          funding_order_id: string
          id: string
          last_error_code: string | null
          merchant_connection_id: string
          merchant_id: string
          organization_id: number
          paypal_capture_id: string | null
          provider_status: string | null
          reference_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          completed_at?: string | null
          created_at?: string
          currency: string
          donation_record_id: string
          funding_order_id: string
          id?: string
          last_error_code?: string | null
          merchant_connection_id: string
          merchant_id: string
          organization_id: number
          paypal_capture_id?: string | null
          provider_status?: string | null
          reference_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          donation_record_id?: string
          funding_order_id?: string
          id?: string
          last_error_code?: string | null
          merchant_connection_id?: string
          merchant_id?: string
          organization_id?: number
          paypal_capture_id?: string | null
          provider_status?: string | null
          reference_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_funding_units_donation_record_id_fkey"
            columns: ["donation_record_id"]
            isOneToOne: true
            referencedRelation: "donation_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_funding_units_funding_order_id_fkey"
            columns: ["funding_order_id"]
            isOneToOne: false
            referencedRelation: "campaign_funding_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_funding_units_merchant_connection_id_fkey"
            columns: ["merchant_connection_id"]
            isOneToOne: false
            referencedRelation: "paypal_merchant_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_funding_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      developer_api_keys: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_four: string
          last_used_at: string | null
          name: string
          project_id: string
          revoked_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_four: string
          last_used_at?: string | null
          name: string
          project_id: string
          revoked_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_four?: string
          last_used_at?: string | null
          name?: string
          project_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_api_keys_project_id_company_id_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "developer_projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      developer_events: {
        Row: {
          company_id: string
          created_at: string
          event_data: Json
          event_type: string
          external_event_id: string
          id: string
          occurred_at: string
          project_id: string
          source: string
          supporter_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          event_data?: Json
          event_type: string
          external_event_id: string
          id?: string
          occurred_at: string
          project_id: string
          source?: string
          supporter_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          event_data?: Json
          event_type?: string
          external_event_id?: string
          id?: string
          occurred_at?: string
          project_id?: string
          source?: string
          supporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_events_supporter_id_project_id_company_id_fkey"
            columns: ["supporter_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id", "project_id", "company_id"]
          },
        ]
      }
      developer_projects: {
        Row: {
          allowed_origins: string[]
          company_id: string
          created_at: string
          created_by: string | null
          environment: string
          id: string
          name: string
          publishable_key: string
          updated_at: string
        }
        Insert: {
          allowed_origins?: string[]
          company_id: string
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          name: string
          publishable_key: string
          updated_at?: string
        }
        Update: {
          allowed_origins?: string[]
          company_id?: string
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          name?: string
          publishable_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      donation_sessions: {
        Row: {
          amount_minor: number
          campaign_id: string
          company_id: string
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          last_error_code: string | null
          merchant_connection_id: string
          organization_id: number
          paypal_capture_id: string | null
          paypal_order_id: string | null
          provider_status: string | null
          public_reference: string
          request_id: string
          status: string
          updated_at: string
          visitor_key_hash: string
        }
        Insert: {
          amount_minor: number
          campaign_id: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          last_error_code?: string | null
          merchant_connection_id: string
          organization_id: number
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          provider_status?: string | null
          public_reference: string
          request_id: string
          status?: string
          updated_at?: string
          visitor_key_hash: string
        }
        Update: {
          amount_minor?: number
          campaign_id?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          last_error_code?: string | null
          merchant_connection_id?: string
          organization_id?: number
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          provider_status?: string | null
          public_reference?: string
          request_id?: string
          status?: string
          updated_at?: string
          visitor_key_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_sessions_campaign_company_fkey"
            columns: ["campaign_id", "company_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "donation_sessions_campaign_organization_fkey"
            columns: ["campaign_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "campaign_organizations"
            referencedColumns: ["campaign_id", "organization_id"]
          },
          {
            foreignKeyName: "donation_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_sessions_merchant_connection_id_fkey"
            columns: ["merchant_connection_id"]
            isOneToOne: false
            referencedRelation: "paypal_merchant_connections"
            referencedColumns: ["id"]
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
      entitlement_assistant_runs: {
        Row: {
          applied_at: string | null
          company_id: string
          created_at: string
          id: string
          model: string
          project_id: string
          prompt: string
          proposal: Json | null
          provider: string
          referenced_entitlement_ids: string[]
          requested_by: string | null
          response_message: string
          status: string
        }
        Insert: {
          applied_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          model: string
          project_id: string
          prompt: string
          proposal?: Json | null
          provider?: string
          referenced_entitlement_ids?: string[]
          requested_by?: string | null
          response_message: string
          status?: string
        }
        Update: {
          applied_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          model?: string
          project_id?: string
          prompt?: string
          proposal?: Json | null
          provider?: string
          referenced_entitlement_ids?: string[]
          requested_by?: string | null
          response_message?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_assistant_runs_project_id_company_id_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "developer_projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      entitlement_definitions: {
        Row: {
          company_id: string
          created_at: string
          description: string
          entitlement_key: string
          id: string
          name: string
          project_id: string
          state: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string
          entitlement_key: string
          id?: string
          name: string
          project_id: string
          state?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          entitlement_key?: string
          id?: string
          name?: string
          project_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_definitions_project_id_company_id_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "developer_projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      entitlement_rules: {
        Row: {
          amount_threshold_minor: number | null
          company_id: string
          created_at: string
          currency: string | null
          entitlement_id: string
          entitlement_key: string
          evaluation_window: string
          event_type: string
          id: string
          metric: string
          name: string
          project_id: string
          state: string
          threshold: number
          updated_at: string
        }
        Insert: {
          amount_threshold_minor?: number | null
          company_id: string
          created_at?: string
          currency?: string | null
          entitlement_id: string
          entitlement_key: string
          evaluation_window: string
          event_type: string
          id?: string
          metric?: string
          name: string
          project_id: string
          state?: string
          threshold: number
          updated_at?: string
        }
        Update: {
          amount_threshold_minor?: number | null
          company_id?: string
          created_at?: string
          currency?: string | null
          entitlement_id?: string
          entitlement_key?: string
          evaluation_window?: string
          event_type?: string
          id?: string
          metric?: string
          name?: string
          project_id?: string
          state?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_rules_definition_fkey"
            columns: ["entitlement_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "entitlement_definitions"
            referencedColumns: ["id", "project_id", "company_id"]
          },
          {
            foreignKeyName: "entitlement_rules_project_id_company_id_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "developer_projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      impact_report_drafts: {
        Row: {
          allocation_snapshot_id: string
          campaign_id: string
          company_id: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          model: string
          period_id: string
          prompt_version: string
          provider: string
          reviewed_at: string | null
          reviewed_by: string | null
          revision: number
          schema_version: string
          source_catalog: Json
          source_digest: string
          status: string
          updated_at: string
        }
        Insert: {
          allocation_snapshot_id: string
          campaign_id: string
          company_id: string
          content: Json
          created_at?: string
          created_by?: string | null
          id?: string
          model: string
          period_id: string
          prompt_version: string
          provider: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision: number
          schema_version: string
          source_catalog: Json
          source_digest: string
          status?: string
          updated_at?: string
        }
        Update: {
          allocation_snapshot_id?: string
          campaign_id?: string
          company_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string
          period_id?: string
          prompt_version?: string
          provider?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          schema_version?: string
          source_catalog?: Json
          source_digest?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_report_drafts_campaign_company_fkey"
            columns: ["campaign_id", "company_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "impact_report_drafts_snapshot_fkey"
            columns: ["allocation_snapshot_id", "period_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "allocation_snapshots"
            referencedColumns: ["id", "period_id", "campaign_id"]
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
          created_by: string | null
          created_by_company_id: string | null
          id: number
          is_active: boolean
          name: string
          short_description: string
          slug: string
          verification_state: string
          visibility: string
          website_url: string | null
        }
        Insert: {
          brand_color?: string
          category: string
          country_code?: string
          created_at?: string
          created_by?: string | null
          created_by_company_id?: string | null
          id?: number
          is_active?: boolean
          name: string
          short_description: string
          slug: string
          verification_state?: string
          visibility?: string
          website_url?: string | null
        }
        Update: {
          brand_color?: string
          category?: string
          country_code?: string
          created_at?: string
          created_by?: string | null
          created_by_company_id?: string | null
          id?: number
          is_active?: boolean
          name?: string
          short_description?: string
          slug?: string
          verification_state?: string
          visibility?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_company_id_fkey"
            columns: ["created_by_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          company_id: string | null
          delivery_count: number
          environment: string
          event_summary: Json
          event_type: string
          first_received_at: string
          id: number
          last_received_at: string
          payload_hash: string
          payment_transaction_id: string | null
          processed_at: string | null
          processing_error_code: string | null
          processing_status: string
          provider: string
          provider_batch_id: string | null
          provider_event_id: string
          provider_item_id: string | null
          provider_resource_id: string | null
          resource_status: string | null
          sender_item_id: string | null
          transmission_id: string
          verification_status: string
        }
        Insert: {
          company_id?: string | null
          delivery_count?: number
          environment?: string
          event_summary?: Json
          event_type: string
          first_received_at?: string
          id?: never
          last_received_at?: string
          payload_hash: string
          payment_transaction_id?: string | null
          processed_at?: string | null
          processing_error_code?: string | null
          processing_status?: string
          provider?: string
          provider_batch_id?: string | null
          provider_event_id: string
          provider_item_id?: string | null
          provider_resource_id?: string | null
          resource_status?: string | null
          sender_item_id?: string | null
          transmission_id: string
          verification_status?: string
        }
        Update: {
          company_id?: string | null
          delivery_count?: number
          environment?: string
          event_summary?: Json
          event_type?: string
          first_received_at?: string
          id?: never
          last_received_at?: string
          payload_hash?: string
          payment_transaction_id?: string | null
          processed_at?: string | null
          processing_error_code?: string | null
          processing_status?: string
          provider?: string
          provider_batch_id?: string | null
          provider_event_id?: string
          provider_item_id?: string | null
          provider_resource_id?: string | null
          resource_status?: string | null
          sender_item_id?: string | null
          transmission_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_minor: number
          campaign_id: string
          company_id: string
          completed_at: string | null
          created_at: string
          currency: string
          donation_record_id: string
          environment: string
          error_details: Json
          flow: string
          id: string
          initiated_by: string | null
          last_error_code: string | null
          last_reconciliation_attempt_at: string | null
          last_reconciliation_error: string | null
          last_reconciliation_success_at: string | null
          next_reconcile_at: string | null
          provider: string
          provider_batch_id: string | null
          provider_debug_id: string | null
          provider_item_id: string | null
          provider_status: string | null
          recipient_reference_masked: string
          recipient_type: string
          reconciliation_attempts: number
          request_attempts: number
          request_payload_hash: string | null
          requested_at: string | null
          sender_batch_id: string
          sender_item_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          campaign_id: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          currency: string
          donation_record_id: string
          environment?: string
          error_details?: Json
          flow?: string
          id?: string
          initiated_by?: string | null
          last_error_code?: string | null
          last_reconciliation_attempt_at?: string | null
          last_reconciliation_error?: string | null
          last_reconciliation_success_at?: string | null
          next_reconcile_at?: string | null
          provider?: string
          provider_batch_id?: string | null
          provider_debug_id?: string | null
          provider_item_id?: string | null
          provider_status?: string | null
          recipient_reference_masked: string
          recipient_type?: string
          reconciliation_attempts?: number
          request_attempts?: number
          request_payload_hash?: string | null
          requested_at?: string | null
          sender_batch_id: string
          sender_item_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          campaign_id?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          donation_record_id?: string
          environment?: string
          error_details?: Json
          flow?: string
          id?: string
          initiated_by?: string | null
          last_error_code?: string | null
          last_reconciliation_attempt_at?: string | null
          last_reconciliation_error?: string | null
          last_reconciliation_success_at?: string | null
          next_reconcile_at?: string | null
          provider?: string
          provider_batch_id?: string | null
          provider_debug_id?: string | null
          provider_item_id?: string | null
          provider_status?: string | null
          recipient_reference_masked?: string
          recipient_type?: string
          reconciliation_attempts?: number
          request_attempts?: number
          request_payload_hash?: string | null
          requested_at?: string | null
          sender_batch_id?: string
          sender_item_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_campaign_company_fkey"
            columns: ["campaign_id", "company_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "payment_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_donation_record_id_fkey"
            columns: ["donation_record_id"]
            isOneToOne: true
            referencedRelation: "donation_records"
            referencedColumns: ["id"]
          },
        ]
      }
      paypal_merchant_connections: {
        Row: {
          capabilities: Json
          consent_status: string | null
          created_at: string
          created_by: string | null
          curation_state: string
          environment: string
          id: string
          initiated_for_campaign_id: string | null
          last_error_code: string | null
          last_verified_at: string | null
          merchant_id: string | null
          organization_id: number
          partner_referral_id: string | null
          payments_receivable: boolean
          permissions_granted: boolean
          primary_email_confirmed: boolean
          products: Json
          recipient_invitation_id: string | null
          status: string
          tracking_id: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          consent_status?: string | null
          created_at?: string
          created_by?: string | null
          curation_state?: string
          environment?: string
          id?: string
          initiated_for_campaign_id?: string | null
          last_error_code?: string | null
          last_verified_at?: string | null
          merchant_id?: string | null
          organization_id: number
          partner_referral_id?: string | null
          payments_receivable?: boolean
          permissions_granted?: boolean
          primary_email_confirmed?: boolean
          products?: Json
          recipient_invitation_id?: string | null
          status?: string
          tracking_id: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          consent_status?: string | null
          created_at?: string
          created_by?: string | null
          curation_state?: string
          environment?: string
          id?: string
          initiated_for_campaign_id?: string | null
          last_error_code?: string | null
          last_verified_at?: string | null
          merchant_id?: string | null
          organization_id?: number
          partner_referral_id?: string | null
          payments_receivable?: boolean
          permissions_granted?: boolean
          primary_email_confirmed?: boolean
          products?: Json
          recipient_invitation_id?: string | null
          status?: string
          tracking_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paypal_merchant_connections_initiated_for_campaign_id_fkey"
            columns: ["initiated_for_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paypal_merchant_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paypal_merchant_connections_recipient_invitation_id_fkey"
            columns: ["recipient_invitation_id"]
            isOneToOne: false
            referencedRelation: "recipient_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      paypal_order_events: {
        Row: {
          campaign_id: string | null
          company_id: string | null
          delivery_count: number
          donation_session_id: string | null
          event_summary: Json
          event_type: string
          first_received_at: string
          id: number
          last_received_at: string
          merchant_id: string | null
          payload_hash: string
          paypal_capture_id: string | null
          paypal_order_id: string | null
          processed_at: string | null
          processing_status: string
          provider_event_id: string
          resource_id: string | null
          resource_status: string | null
          transmission_id: string
        }
        Insert: {
          campaign_id?: string | null
          company_id?: string | null
          delivery_count?: number
          donation_session_id?: string | null
          event_summary?: Json
          event_type: string
          first_received_at?: string
          id?: never
          last_received_at?: string
          merchant_id?: string | null
          payload_hash: string
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider_event_id: string
          resource_id?: string | null
          resource_status?: string | null
          transmission_id: string
        }
        Update: {
          campaign_id?: string | null
          company_id?: string | null
          delivery_count?: number
          donation_session_id?: string | null
          event_summary?: Json
          event_type?: string
          first_received_at?: string
          id?: never
          last_received_at?: string
          merchant_id?: string | null
          payload_hash?: string
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider_event_id?: string
          resource_id?: string | null
          resource_status?: string | null
          transmission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paypal_order_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paypal_order_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paypal_order_events_donation_session_id_fkey"
            columns: ["donation_session_id"]
            isOneToOne: false
            referencedRelation: "donation_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      supporter_entitlement_events: {
        Row: {
          campaign_id: string
          company_id: string
          created_at: string
          entitlement_id: string
          event_type: string
          id: number
          qualifying_count: number
          source_donation_session_id: string | null
        }
        Insert: {
          campaign_id: string
          company_id: string
          created_at?: string
          entitlement_id: string
          event_type: string
          id?: never
          qualifying_count: number
          source_donation_session_id?: string | null
        }
        Update: {
          campaign_id?: string
          company_id?: string
          created_at?: string
          entitlement_id?: string
          event_type?: string
          id?: never
          qualifying_count?: number
          source_donation_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supporter_entitlement_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supporter_entitlement_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supporter_entitlement_events_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "supporter_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supporter_entitlement_events_source_donation_session_id_fkey"
            columns: ["source_donation_session_id"]
            isOneToOne: false
            referencedRelation: "donation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      supporter_entitlements: {
        Row: {
          campaign_id: string
          company_id: string
          created_at: string
          entitlement_key: string
          id: string
          qualified_at: string | null
          qualifying_count: number
          revoked_at: string | null
          state: string
          updated_at: string
          valid_until: string | null
          visitor_key_hash: string
        }
        Insert: {
          campaign_id: string
          company_id: string
          created_at?: string
          entitlement_key: string
          id?: string
          qualified_at?: string | null
          qualifying_count?: number
          revoked_at?: string | null
          state?: string
          updated_at?: string
          valid_until?: string | null
          visitor_key_hash: string
        }
        Update: {
          campaign_id?: string
          company_id?: string
          created_at?: string
          entitlement_key?: string
          id?: string
          qualified_at?: string | null
          qualifying_count?: number
          revoked_at?: string | null
          state?: string
          updated_at?: string
          valid_until?: string | null
          visitor_key_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "supporter_entitlements_campaign_company_fkey"
            columns: ["campaign_id", "company_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "supporter_entitlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recipient_invitations: {
        Row: {
          accepted_at: string | null
          claimed_at: string | null
          claimed_by_user_id: string | null
          company_id: string
          contact_email: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          last_opened_at: string | null
          organization_id: number
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          company_id: string
          contact_email: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          last_opened_at?: string | null
          organization_id: number
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          company_id?: string
          contact_email?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          last_opened_at?: string | null
          organization_id?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipient_invitations_company_id_organization_id_fkey"
            columns: ["company_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "workspace_recipients"
            referencedColumns: ["company_id", "organization_id"]
          },
        ]
      }
      recipient_memberships: {
        Row: {
          claimed_email: string
          company_id: string
          created_at: string
          invitation_id: string
          organization_id: number
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_email: string
          company_id: string
          created_at?: string
          invitation_id: string
          organization_id: number
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_email?: string
          company_id?: string
          created_at?: string
          invitation_id?: string
          organization_id?: number
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipient_memberships_invitation_fkey"
            columns: ["invitation_id", "company_id", "organization_id"]
            isOneToOne: true
            referencedRelation: "recipient_invitations"
            referencedColumns: ["id", "company_id", "organization_id"]
          },
          {
            foreignKeyName: "recipient_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supporters: {
        Row: {
          company_id: string
          created_at: string
          display_name: string | null
          external_user_id: string
          id: string
          last_seen_at: string
          project_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          display_name?: string | null
          external_user_id: string
          id?: string
          last_seen_at?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          display_name?: string | null
          external_user_id?: string
          id?: string
          last_seen_at?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supporters_project_id_company_id_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "developer_projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      user_entitlement_events: {
        Row: {
          company_id: string
          created_at: string
          entitlement_id: string
          event_type: string
          id: number
          project_id: string
          qualifying_count: number
          source_event_id: string
          supporter_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entitlement_id: string
          event_type: string
          id?: never
          project_id: string
          qualifying_count: number
          source_event_id: string
          supporter_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entitlement_id?: string
          event_type?: string
          id?: never
          project_id?: string
          qualifying_count?: number
          source_event_id?: string
          supporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlement_events_entitlement_id_project_id_company__fkey"
            columns: ["entitlement_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "user_entitlements"
            referencedColumns: ["id", "project_id", "company_id"]
          },
          {
            foreignKeyName: "user_entitlement_events_source_event_id_project_id_company_fkey"
            columns: ["source_event_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "developer_events"
            referencedColumns: ["id", "project_id", "company_id"]
          },
          {
            foreignKeyName: "user_entitlement_events_supporter_id_project_id_company_id_fkey"
            columns: ["supporter_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id", "project_id", "company_id"]
          },
        ]
      }
      user_entitlements: {
        Row: {
          company_id: string
          created_at: string
          entitlement_definition_id: string
          entitlement_key: string
          id: string
          progress_unit: string
          progress_value: number
          project_id: string
          qualified_at: string | null
          qualifying_count: number
          revoked_at: string | null
          rule_id: string
          state: string
          supporter_id: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          entitlement_definition_id: string
          entitlement_key: string
          id?: string
          progress_unit?: string
          progress_value?: number
          project_id: string
          qualified_at?: string | null
          qualifying_count?: number
          revoked_at?: string | null
          rule_id: string
          state?: string
          supporter_id: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          entitlement_definition_id?: string
          entitlement_key?: string
          id?: string
          progress_unit?: string
          progress_value?: number
          project_id?: string
          qualified_at?: string | null
          qualifying_count?: number
          revoked_at?: string | null
          rule_id?: string
          state?: string
          supporter_id?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlements_definition_fkey"
            columns: ["entitlement_definition_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "entitlement_definitions"
            referencedColumns: ["id", "project_id", "company_id"]
          },
          {
            foreignKeyName: "user_entitlements_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "entitlement_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_entitlements_supporter_id_project_id_company_id_fkey"
            columns: ["supporter_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id", "project_id", "company_id"]
          },
        ]
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
      webhook_deliveries: {
        Row: {
          attempt_count: number
          company_id: string
          created_at: string
          delivered_at: string | null
          entitlement_event_id: number | null
          event_type: string
          id: string
          last_attempt_at: string | null
          last_error_code: string | null
          next_attempt_at: string
          payload: Json
          project_id: string
          response_status: number | null
          source_event_id: string | null
          status: string
          updated_at: string
          webhook_endpoint_id: string
        }
        Insert: {
          attempt_count?: number
          company_id: string
          created_at?: string
          delivered_at?: string | null
          entitlement_event_id?: number | null
          event_type: string
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          next_attempt_at?: string
          payload: Json
          project_id: string
          response_status?: number | null
          source_event_id?: string | null
          status?: string
          updated_at?: string
          webhook_endpoint_id: string
        }
        Update: {
          attempt_count?: number
          company_id?: string
          created_at?: string
          delivered_at?: string | null
          entitlement_event_id?: number | null
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          next_attempt_at?: string
          payload?: Json
          project_id?: string
          response_status?: number | null
          source_event_id?: string | null
          status?: string
          updated_at?: string
          webhook_endpoint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_entitlement_event_id_fkey"
            columns: ["entitlement_event_id"]
            isOneToOne: false
            referencedRelation: "user_entitlement_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_source_event_id_project_id_company_id_fkey"
            columns: ["source_event_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "developer_events"
            referencedColumns: ["id", "project_id", "company_id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_endpoint_id_project_id_company__fkey"
            columns: ["webhook_endpoint_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id", "project_id", "company_id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          project_id: string
          state: string
          subscribed_events: string[]
          updated_at: string
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          project_id: string
          state?: string
          subscribed_events?: string[]
          updated_at?: string
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          project_id?: string
          state?: string
          subscribed_events?: string[]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_project_id_company_id_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "developer_projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      workspace_recipients: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          organization_id: number
          relationship_state: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          organization_id: number
          relationship_state?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          organization_id?: number
          relationship_state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_recipients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      claim_developer_webhook_deliveries: {
        Args: { p_limit?: number; p_project_id?: string }
        Returns: {
          attempt_count: number
          company_id: string
          created_at: string
          delivered_at: string | null
          entitlement_event_id: number | null
          event_type: string
          id: string
          last_attempt_at: string | null
          last_error_code: string | null
          next_attempt_at: string
          payload: Json
          project_id: string
          response_status: number | null
          source_event_id: string | null
          status: string
          updated_at: string
          webhook_endpoint_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "webhook_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_paypal_sandbox_reconciliations: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          payment_transaction_id: string
          provider_batch_id: string
          sender_item_id: string
        }[]
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
      create_impact_report_draft: {
        Args: {
          p_allocation_snapshot_id: string
          p_campaign_id: string
          p_content: Json
          p_model: string
          p_period_id: string
          p_prompt_version: string
          p_provider: string
          p_schema_version: string
          p_source_catalog: Json
          p_source_digest: string
        }
        Returns: string
      }
      create_workspace_recipient: {
        Args: {
          p_brand_color: string
          p_category: string
          p_company_id: string
          p_country_code: string
          p_name: string
          p_short_description: string
          p_website_url: string
        }
        Returns: {
          brand_color: string
          category: string
          country_code: string
          created_at: string
          created_by: string | null
          created_by_company_id: string | null
          id: number
          is_active: boolean
          name: string
          short_description: string
          slug: string
          verification_state: string
          visibility: string
          website_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_campaign_period_now: {
        Args: { p_period_id: string }
        Returns: Json
      }
      get_campaign_paypal_recipients: {
        Args: { p_public_id: string }
        Returns: {
          merchant_id: string
          organization_id: number
        }[]
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
          donation_environment: string
          donation_status: string
          organization_id: number
          period_closed_at: string
          period_id: string
          period_sequence: number
          sandbox_confirmed_minor: number
          simulation_confirmed_minor: number
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
      record_campaign_funding_capture: {
        Args: {
          p_funding_order_id: string
          p_order_status: string
          p_paypal_order_id: string
          p_units: Json
        }
        Returns: Json
      }
      record_campaign_funding_webhook: {
        Args: {
          p_custom_id?: string
          p_event_type: string
          p_paypal_capture_id?: string
          p_paypal_order_id?: string
          p_provider_event_id: string
          p_resource_status?: string
        }
        Returns: Json
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
      record_paypal_sandbox_reconciliation: {
        Args: {
          p_batch_status?: string
          p_item_status?: string
          p_payment_transaction_id: string
          p_provider_batch_id: string
          p_provider_item_id?: string
          p_sender_item_id?: string
        }
        Returns: Json
      }
      record_paypal_sandbox_reconciliation_error: {
        Args: { p_error_code: string; p_payment_transaction_id: string }
        Returns: Json
      }
      record_paypal_sandbox_request_result: {
        Args: {
          p_error_code?: string
          p_outcome: string
          p_payment_transaction_id: string
          p_provider_batch_id?: string
          p_provider_status?: string
          p_request_payload_hash?: string
        }
        Returns: Json
      }
      record_paypal_sandbox_request_result_v2: {
        Args: {
          p_error_code?: string
          p_error_details?: Json
          p_outcome: string
          p_payment_transaction_id: string
          p_provider_batch_id?: string
          p_provider_debug_id?: string
          p_provider_status?: string
          p_request_payload_hash?: string
        }
        Returns: Json
      }
      record_verified_paypal_order_webhook: {
        Args: {
          p_custom_id?: string
          p_event_summary?: Json
          p_event_type: string
          p_merchant_id?: string
          p_payload_hash?: string
          p_paypal_capture_id?: string
          p_paypal_order_id?: string
          p_provider_event_id: string
          p_resource_id?: string
          p_resource_status?: string
          p_transmission_id: string
        }
        Returns: Json
      }
      record_verified_paypal_webhook: {
        Args: {
          p_event_summary?: Json
          p_event_type: string
          p_payload_hash?: string
          p_provider_batch_id?: string
          p_provider_event_id: string
          p_provider_item_id?: string
          p_provider_resource_id?: string
          p_resource_status?: string
          p_sender_item_id?: string
          p_transmission_id: string
        }
        Returns: Json
      }
      reserve_campaign_funding_order: {
        Args: {
          p_initiated_by: string
          p_request_id: string
          p_snapshot_id: string
        }
        Returns: Json
      }
      reserve_paypal_sandbox_payout: {
        Args: {
          p_donation_record_id: string
          p_recipient_reference_masked: string
        }
        Returns: Json
      }
      resolve_zero_vote_allocation: {
        Args: { p_resolution: string; p_snapshot_id: string }
        Returns: Json
      }
      review_impact_report_draft: {
        Args: { p_draft_id: string; p_status: string }
        Returns: undefined
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
  Database["public"]["Tables"][Name]["Row"]
