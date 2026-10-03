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
      addresses: {
        Row: {
          additional_info: string | null
          address_line: string
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          phone: string
          recipient_name: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_info?: string | null
          address_line: string
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          phone: string
          recipient_name: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_info?: string | null
          address_line?: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          phone?: string
          recipient_name?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          weekly_menu_product_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity: number
          updated_at?: string
          weekly_menu_product_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          weekly_menu_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_weekly_menu_product_id_fkey"
            columns: ["weekly_menu_product_id"]
            isOneToOne: false
            referencedRelation: "weekly_menu_products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          quantity: number
          reason: string
          weekly_menu_product_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          quantity: number
          reason: string
          weekly_menu_product_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          quantity?: number
          reason?: string
          weekly_menu_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_weekly_menu_product_id_fkey"
            columns: ["weekly_menu_product_id"]
            isOneToOne: false
            referencedRelation: "weekly_menu_products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          order_id: string | null
          payment_id: string | null
          quantity: number
          released_at: string | null
          reservation_type: Database["public"]["Enums"]["reservation_type"]
          status: Database["public"]["Enums"]["reservation_status"]
          weekly_menu_product_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          payment_id?: string | null
          quantity: number
          released_at?: string | null
          reservation_type: Database["public"]["Enums"]["reservation_type"]
          status?: Database["public"]["Enums"]["reservation_status"]
          weekly_menu_product_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          payment_id?: string | null
          quantity?: number
          released_at?: string | null
          reservation_type?: Database["public"]["Enums"]["reservation_type"]
          status?: Database["public"]["Enums"]["reservation_status"]
          weekly_menu_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_weekly_menu_product_id_fkey"
            columns: ["weekly_menu_product_id"]
            isOneToOne: false
            referencedRelation: "weekly_menu_products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_description: string
          product_image: string | null
          product_ingredients: string
          product_name: string
          quantity: number
          unit_price: number
          weekly_menu_product_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_description?: string
          product_image?: string | null
          product_ingredients?: string
          product_name: string
          quantity: number
          unit_price: number
          weekly_menu_product_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_description?: string
          product_image?: string | null
          product_ingredients?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          weekly_menu_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_weekly_menu_product_id_fkey"
            columns: ["weekly_menu_product_id"]
            isOneToOne: false
            referencedRelation: "weekly_menu_products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_additional_info: string | null
          delivery_address: string
          delivery_city: string
          delivery_date: string
          delivery_state: string
          email: string
          id: string
          order_number: string
          order_status: Database["public"]["Enums"]["order_status"]
          paid_at: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          recipient_name: string
          special_notes: string | null
          subtotal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_additional_info?: string | null
          delivery_address: string
          delivery_city: string
          delivery_date: string
          delivery_state: string
          email: string
          id?: string
          order_number?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          paid_at: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          recipient_name: string
          special_notes?: string | null
          subtotal: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_additional_info?: string | null
          delivery_address?: string
          delivery_city?: string
          delivery_date?: string
          delivery_state?: string
          email?: string
          id?: string
          order_number?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          paid_at?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          recipient_name?: string
          special_notes?: string | null
          subtotal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          checkout_snapshot: Json
          created_at: string
          currency: string
          id: string
          order_id: string | null
          paid_at: string | null
          provider: string
          provider_transaction_id: string | null
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_snapshot: Json
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          provider?: string
          provider_transaction_id?: string | null
          reference: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_snapshot?: Json
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          provider?: string
          provider_transaction_id?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string
          created_at: string
          display_order: number
          id: string
          product_id: string
          storage_path: string
        }
        Insert: {
          alt_text?: string
          created_at?: string
          display_order?: number
          id?: string
          product_id: string
          storage_path: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          display_order?: number
          id?: string
          product_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          ingredients: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          ingredients?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          ingredients?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          order_id: string
          payment_id: string
          paystack_refund_id: string | null
          processed_at: string | null
          provider_status: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          order_id: string
          payment_id: string
          paystack_refund_id?: string | null
          processed_at?: string | null
          provider_status?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          order_id?: string
          payment_id?: string
          paystack_refund_id?: string | null
          processed_at?: string | null
          provider_status?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_menu_products: {
        Row: {
          created_at: string
          description_snapshot: string
          id: string
          image_snapshot: string | null
          ingredients_snapshot: string
          locked_at: string | null
          low_stock_threshold: number
          name_snapshot: string
          price: number
          product_id: string
          updated_at: string
          weekly_menu_id: string
          weekly_quantity: number
        }
        Insert: {
          created_at?: string
          description_snapshot?: string
          id?: string
          image_snapshot?: string | null
          ingredients_snapshot?: string
          locked_at?: string | null
          low_stock_threshold?: number
          name_snapshot: string
          price: number
          product_id: string
          updated_at?: string
          weekly_menu_id: string
          weekly_quantity: number
        }
        Update: {
          created_at?: string
          description_snapshot?: string
          id?: string
          image_snapshot?: string | null
          ingredients_snapshot?: string
          locked_at?: string | null
          low_stock_threshold?: number
          name_snapshot?: string
          price?: number
          product_id?: string
          updated_at?: string
          weekly_menu_id?: string
          weekly_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_menu_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_menu_products_weekly_menu_id_fkey"
            columns: ["weekly_menu_id"]
            isOneToOne: false
            referencedRelation: "weekly_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_menus: {
        Row: {
          created_at: string
          expired_at: string | null
          id: string
          published_at: string | null
          status: Database["public"]["Enums"]["menu_status"]
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          expired_at?: string | null
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["menu_status"]
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          expired_at?: string | null
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["menu_status"]
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "CUSTOMER" | "ADMIN"
      menu_status: "DRAFT" | "PUBLISHED" | "EXPIRED"
      order_status:
        | "PAID"
        | "RECEIVED"
        | "BAKING"
        | "READY"
        | "HANDED_TO_DELIVERY"
        | "DELIVERED"
        | "CANCELLED"
      payment_status: "PENDING" | "PAID" | "FAILED" | "REFUNDED"
      refund_status: "NOT_REFUNDED" | "REFUNDED"
      reservation_status: "ACTIVE" | "RELEASED" | "EXPIRED" | "CONVERTED"
      reservation_type: "PAYMENT_TEMPORARY" | "ORDER_CONFIRMED"
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
    Enums: {
      app_role: ["CUSTOMER", "ADMIN"],
      menu_status: ["DRAFT", "PUBLISHED", "EXPIRED"],
      order_status: [
        "PAID",
        "RECEIVED",
        "BAKING",
        "READY",
        "HANDED_TO_DELIVERY",
        "DELIVERED",
        "CANCELLED",
      ],
      payment_status: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      refund_status: ["NOT_REFUNDED", "REFUNDED"],
      reservation_status: ["ACTIVE", "RELEASED", "EXPIRED", "CONVERTED"],
      reservation_type: ["PAYMENT_TEMPORARY", "ORDER_CONFIRMED"],
    },
  },
} as const
