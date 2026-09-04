export interface Document {
  doc_id: string;
  client_id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  status: "processing" | "ready" | "failed";
  error_message?: string;
  chunks_count: number;
  uploaded_at: string;
  processed_at?: string;
}

export interface Source {
  doc_id: string;
  filename: string;
  chunk_index: number;
  score: number;
  text_preview: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp?: string;
}

export interface ChatResponse {
  response: string;
  sources: Source[];
  session_id: string;
}

export interface QueryLog {
  client_id: string;
  session_id: string;
  query: string;
  response: string;
  channel?: string;
  cache_hit?: boolean;
  sources: Source[];
  response_time_ms: number;
  llm_provider: string;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  client_id: string;
  channel: string;
  timestamp: string;
  sender_id?: string;
  sender_name?: string;
  message_in?: string;
  response_out?: string;
  response_time_ms?: number;
  status: string;
  raw_payload?: any;
  outgoing_payload?: any;
  meta_status?: number;
  meta_response?: any;
  metadata?: Record<string, any>;
  error?: string;
  traceback?: string;
}

export interface User {
  email: string;
  client_id: string;
  role: string;
}

// ── Setup types ────────────────────────────────────────────────────────────────

export type SetupChannel = "widget" | "web_api" | "whatsapp" | "facebook" | "telegram" | "slack";

export interface SetupSummary {
  channel: SetupChannel;
  label: string;
  emoji: string;
  enabled: boolean;
  rate_limit_rpm: number;
  rate_limit_rpd: number;
  max_queries_per_session: number;
  token_set?: boolean; // only for widget / web_api
}

export interface ChannelStats {
  channel: string;
  total_queries: number;
  queries_today: number;
  avg_response_time_ms: number;
  input_tokens: number;
  output_tokens: number;
  cache_hits: number;
  top_queries: { query: string; count: number }[];
  daily_trend: { date: string; count: number }[];
}

// ── Analytics types ────────────────────────────────────────────────────────────

export interface UsageStats {
  total_queries: number;
  queries_today: number;
  avg_response_time_ms: number;
  top_queries: { query: string; count: number }[];
  channel_breakdown: { channel: string; total_queries: number; avg_response_time_ms: number; input_tokens: number; output_tokens: number }[];
  daily_trend: { date: string; count: number }[];
  remaining_llm_quota: number;
}

export interface SubMenu {
  id: string;
  label: string;
  sub_questions: string[];
}

export interface MenuOption {
  id: string;
  label: string;
  submenus: SubMenu[];
}

export interface ClientSettings {
  welcome_message?: string;
  theme_color?: string;
  chatbot_title?: string;
  custom_widget_script?: string;
  menu_options?: MenuOption[];
  system_prompt?: string;
  max_history_turns?: number;
  setups?: Record<string, Record<string, unknown>>;
}

export interface ClientRecord {
  client_id: string;
  name: string;
  domain?: string;
  created_at?: string;
  settings?: ClientSettings;
}

export interface ClientUsageSummary {
  client_id: string;
  name: string;
  created_at?: string;
  total_queries: number;
  queries_this_month: number;
  queries_today: number;
  avg_response_time_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  document_count: number;
}

export interface SuperAdminOverview {
  clients: ClientUsageSummary[];
  total_clients: number;
  platform_total_queries: number;
  platform_total_input_tokens: number;
  platform_total_output_tokens: number;
  platform_channel_breakdown: Record<string, number>;
}

export interface SuperAdminClientDetail extends UsageStats {
  total_input_tokens: number;
  total_output_tokens: number;
  document_count: number;
  logs: QueryLog[];
  logs_total: number;
  logs_page: number;
  logs_page_size: number;
}

// Keep for backward compat
export type ClientSettingsFull = ClientSettings;
