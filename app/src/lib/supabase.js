import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xpjvpcreljzavelbtjxj.supabase.co";

const supabaseKey = "sb_publishable_ODr-ZjEuq14IRSwBBrhVgA_-aj0dOh9";

export const supabase = createClient(supabaseUrl, supabaseKey);