import { supabase } from "./supabase";

export async function generateNumber(sequenceName) {
  const { data, error } = await supabase
    .from("number_sequences")
    .select("*")
    .eq("sequence_name", sequenceName)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const nextNumber = Number(data.current_number || 0) + 1;
  const formattedNumber = `${data.prefix}-${String(nextNumber).padStart(6, "0")}`;

  const { error: updateError } = await supabase
    .from("number_sequences")
    .update({ current_number: nextNumber })
    .eq("id", data.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return formattedNumber;
}