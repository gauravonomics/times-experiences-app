-- Function call logging table for agent evaluation framework
CREATE TABLE public.function_call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  tool_name TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_function_call_logs_conversation ON public.function_call_logs(conversation_id);
CREATE INDEX idx_function_call_logs_account ON public.function_call_logs(account_id);
CREATE INDEX idx_function_call_logs_tool ON public.function_call_logs(tool_name);
CREATE INDEX idx_function_call_logs_created ON public.function_call_logs(created_at);

ALTER TABLE public.function_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all function call logs"
  ON public.function_call_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert function call logs"
  ON public.function_call_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
