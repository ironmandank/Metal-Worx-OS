import { supabase } from "../lib/supabase";
import { createNotificationsForAssignedNames } from "./notificationService";

export async function getChatChannels() {
  const { data, error } = await supabase
    .from("internal_chat_channels")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function getChannelMessages(channelId) {
  if (!channelId) return [];

  const { data, error } = await supabase
    .from("internal_chat_messages")
    .select(`
      *,
      attachments:internal_chat_attachments(*)
    `)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) throw error;

  return data || [];
}

export function extractMentions(messageBody) {
  if (!messageBody) return [];

  const matches = messageBody.match(/@([A-Za-z0-9_.-]+)/g) || [];

  return Array.from(
    new Set(
      matches
        .map((mention) => mention.replace("@", "").trim())
        .filter(Boolean)
    )
  );
}

async function uploadChatFile(file, messageId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${messageId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("internal-chat")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("internal-chat")
    .getPublicUrl(filePath);

  const fileUrl = publicUrlData?.publicUrl || null;

  const { data, error } = await supabase
    .from("internal_chat_attachments")
    .insert({
      message_id: messageId,
      file_name: file.name,
      file_path: filePath,
      file_url: fileUrl,
      file_type: file.type || null,
      file_size: file.size || null,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function sendChatMessage({
  channelId,
  senderName,
  messageBody,
  directToName = null,
  sourceType = null,
  sourceId = null,
  files = [],
}) {
  if (!channelId) throw new Error("Missing chat channel.");
  if (!senderName) throw new Error("Missing sender.");

  const cleanMessage = messageBody?.trim() || "";

  if (!cleanMessage && files.length === 0) {
    throw new Error("Enter a message or attach a file before sending.");
  }

  const mentionedNames = extractMentions(cleanMessage);

  const { data: message, error } = await supabase
    .from("internal_chat_messages")
    .insert({
      channel_id: channelId,
      sender_name: senderName,
      message_body: cleanMessage || "(attachment)",
      message_type: directToName ? "Direct" : "Message",
      mentioned_names: mentionedNames,
      direct_to_name: directToName || null,
      source_type: sourceType,
      source_id: sourceId ? String(sourceId) : null,
      is_system_message: false,
    })
    .select()
    .single();

  if (error) throw error;

  const uploadedAttachments = [];

  for (const file of files) {
    const attachment = await uploadChatFile(file, message.id);
    uploadedAttachments.push(attachment);
  }

  const notificationNames = Array.from(
    new Set(
      [directToName, ...mentionedNames].filter(
        (name) => name && name !== senderName
      )
    )
  );

  if (notificationNames.length > 0) {
    await createNotificationsForAssignedNames({
      assignedToList: notificationNames,
      notificationType: directToName ? "Direct Message" : "Mention",
      title: directToName ? "New Direct Message" : "You Were Mentioned",
      message: `${senderName}: ${cleanMessage || "sent an attachment"}`,
      sourceType: "internal_chat",
      sourceId: String(message.id),
      targetPage: "internalChat",
      priority: directToName ? "High" : "Medium",
    });
  }

  return {
    ...message,
    attachments: uploadedAttachments,
  };
}