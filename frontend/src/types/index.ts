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

export interface UsageStats {
  total_queries: number;
  queries_today: number;
  avg_response_time_ms: number;
  top_queries: { query: string; count: number }[];
  remaining_llm_quota: number;
}

export interface QueryLog {
  client_id: string;
  session_id: string;
  query: string;
  response: string;
  sources: Source[];
  response_time_ms: number;
  llm_provider: string;
  created_at: string;
}

export interface User {
  email: string;
  client_id: string;
  role: string;
}

export interface ClientSettings {
  welcome_message: string;
  system_prompt: string;
  theme_color: string;
  max_history_turns: number;
}

export interface ClientRecord {
  client_id: string;
  name: string;
  domain?: string;
  created_at?: string;
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
}

export interface SuperAdminClientDetail extends UsageStats {
  provider_breakdown: { provider: string; count: number }[];
  total_input_tokens: number;
  total_output_tokens: number;
  document_count: number;
  logs: QueryLog[];
  logs_total: number;
  logs_page: number;
  logs_page_size: number;
}
