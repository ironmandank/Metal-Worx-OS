import { supabase } from "./supabase";

export async function generateNumber(sequenceName) {
  const { data, error } = await supabase.rpc("mw_next_number", {
    p_sequence_name: sequenceName,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`Could not generate the next ${sequenceName} number.`);
  }

  return data;
}
