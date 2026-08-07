import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "A variável NEXT_PUBLIC_SUPABASE_URL não foi configurada.",
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    "A variável NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY não foi configurada.",
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
);