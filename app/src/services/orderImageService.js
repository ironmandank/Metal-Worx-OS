import { supabase } from "../lib/supabase";

export async function uploadOrderImages(orderId, files, imageType = "Reference Image") {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extension = file.name.split(".").pop();
    const stem = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-");
    const path = `${orderId}/${Date.now()}-${index}-${stem}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("order-reference-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("order-reference-images").getPublicUrl(path);
    const { error: imageError } = await supabase
      .from("customer_order_reference_images")
      .insert({
        customer_order_id: orderId,
        image_url: data.publicUrl,
        caption: file.name,
        image_type: imageType,
        show_on_work_order: true,
        sort_order: index + 1,
      });
    if (imageError) throw imageError;
  }
}
