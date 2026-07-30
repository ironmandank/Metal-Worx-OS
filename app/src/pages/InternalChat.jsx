import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Image,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import {
  IconAt,
  IconFile,
  IconMessageCircle,
  IconPaperclip,
  IconSend,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

import MWPageHeader from "../components/ui/MWPageHeader";

import { getActiveProfiles } from "../services/notificationService";

import {
  getChatChannels,
  getChannelMessages,
  sendChatMessage,
} from "../services/chatService";

function InternalChat({ setPage, activeUser = "Dan" }) {
  const [profiles, setProfiles] = useState([]);
  const [channelId, setChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [directToName, setDirectToName] = useState(null);
  const [messageBody, setMessageBody] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messageEndRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!channelId) return;

    loadMessages(channelId);

    const timer = setInterval(() => {
      loadMessages(channelId, false);
    }, 5000);

    return () => clearInterval(timer);
  }, [channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, directToName]);

  async function loadInitialData() {
    setLoading(true);

    try {
      const [profileData, channelData] = await Promise.all([
        getActiveProfiles(),
        getChatChannels(),
      ]);

      setProfiles(profileData || []);

      const defaultChannel =
        (channelData || []).find((channel) => channel.name === "Shop Floor") ||
        channelData?.[0];

      setChannelId(defaultChannel?.id || null);
    } catch (error) {
      notifications.show({
        title: "Chat Failed to Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(selectedChannelId, shouldScroll = true) {
    try {
      const data = await getChannelMessages(selectedChannelId);
      setMessages(data || []);

      if (shouldScroll) {
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error("Chat message load error:", error);
    }
  }

  function scrollToBottom() {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }

  function getInitials(name) {
    if (!name) return "?";

    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function formatTime(value) {
    if (!value) return "";

    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function isImageAttachment(attachment) {
    return attachment?.file_type?.startsWith("image/");
  }

  function addMention(name) {
    const mention = `@${name}`;

    setMessageBody((current) => {
      if (!current.trim()) return `${mention} `;
      return `${current.trimEnd()} ${mention} `;
    });
  }

  function openTeamChat() {
    setDirectToName(null);
  }

  function startDirectMessage(name) {
    if (name === activeUser) return;
    setDirectToName(name);
  }

  function handleFiles(selectedFiles) {
    const incoming = Array.from(selectedFiles || []);
    if (incoming.length === 0) return;

    setFiles((current) => [...current, ...incoming]);
  }

  function removeFile(indexToRemove) {
    setFiles((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  }

  async function handleSend() {
    if (sending) return;

    if (!channelId) {
      notifications.show({
        title: "Chat Not Ready",
        message: "The chat feed has not loaded yet.",
        color: "red",
      });
      return;
    }

    if (!messageBody.trim() && files.length === 0) {
      notifications.show({
        title: "Nothing to Send",
        message: "Type a message or attach a file.",
        color: "orange",
      });
      return;
    }

    setSending(true);

    try {
      await sendChatMessage({
        channelId,
        senderName: activeUser,
        messageBody,
        directToName,
        files,
      });

      setMessageBody("");
      setFiles([]);

      await loadMessages(channelId);
    } catch (error) {
      notifications.show({
        title: "Message Failed",
        message: error.message,
        color: "red",
      });
    } finally {
      setSending(false);
    }
  }

  function handleMessageKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const people = profiles
    .filter((profile) => profile.profile_type === "Person")
    .map((profile) => profile.display_name)
    .filter(Boolean);

  const visibleMessages = messages.filter((message) => {
    if (!directToName) {
      return !message.direct_to_name;
    }

    return (
      (message.sender_name === activeUser &&
        message.direct_to_name === directToName) ||
      (message.sender_name === directToName &&
        message.direct_to_name === activeUser)
    );
  });

  const conversationTitle = directToName
    ? `Chat with ${directToName}`
    : "Metal Worx Team Chat";

  const conversationSubtitle = directToName
    ? "Direct conversation"
    : "Company-wide conversation";

  return (
    <>
      <MWPageHeader
        title="Internal Chat"
        subtitle="Metal Worx team communication, direct messages, mentions, files, and images."
        setPage={setPage}
        showDashboard={true}
      />

      <div className="mw-teams-chat">
        <Card withBorder radius="lg" p={0} className="mw-teams-people-panel">
          <div className="mw-teams-panel-header">
            <Text fw={800}>Metal Worx Team</Text>

            <Text size="xs" c="dimmed">
              Signed in as {activeUser}
            </Text>
          </div>

          <ScrollArea className="mw-teams-people-scroll">
            <Stack gap={4} p="sm">
              <button
                type="button"
                className={
                  !directToName ? "mw-teams-person active" : "mw-teams-person"
                }
                onClick={openTeamChat}
              >
                <Avatar radius="xl" size="sm" color="red">
                  <IconUsers size={16} />
                </Avatar>

                <div className="mw-teams-person-copy">
                  <strong>Team Chat</strong>
                  <span>Everyone</span>
                </div>
              </button>

              {people.map((person) => {
                const selected = directToName === person;

                return (
                  <button
                    type="button"
                    key={person}
                    className={
                      selected ? "mw-teams-person active" : "mw-teams-person"
                    }
                    onClick={() => startDirectMessage(person)}
                    disabled={person === activeUser}
                  >
                    <Avatar radius="xl" size="sm" color="red">
                      {getInitials(person)}
                    </Avatar>

                    <div className="mw-teams-person-copy">
                      <strong>{person}</strong>

                      <span>
                        {person === activeUser ? "You" : "Direct Message"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </Stack>
          </ScrollArea>
        </Card>

        <Card withBorder radius="lg" p={0} className="mw-teams-chat-panel">
          <div className="mw-teams-chat-header">
            <div>
              <Text fw={800}>{conversationTitle}</Text>

              <Text size="xs" c="dimmed">
                {conversationSubtitle}
              </Text>
            </div>

            <Badge color="red" variant="light">
              {visibleMessages.length} messages
            </Badge>
          </div>

          <ScrollArea className="mw-teams-message-scroll">
            <div className="mw-teams-message-feed">
              {loading ? (
                <Text c="dimmed">Loading chat...</Text>
              ) : visibleMessages.length === 0 ? (
                <div className="mw-teams-empty">
                  <Text fw={700}>No messages yet</Text>

                  <Text size="sm" c="dimmed">
                    Start the conversation below.
                  </Text>
                </div>
              ) : (
                visibleMessages.map((message) => {
                  const mine = message.sender_name === activeUser;

                  return (
                    <div
                      key={message.id}
                      className={
                        mine
                          ? "mw-teams-message-row mine"
                          : "mw-teams-message-row"
                      }
                    >
                      <Avatar radius="xl" size="sm" color="red">
                        {getInitials(message.sender_name)}
                      </Avatar>

                      <div className="mw-teams-message-content">
                        <Group gap="xs" justify={mine ? "flex-end" : "flex-start"}>
                          <Text size="sm" fw={800}>
                            {message.sender_name}
                          </Text>

                          <Text size="xs" c="dimmed">
                            {formatTime(message.created_at)}
                          </Text>
                        </Group>

                        <div
                          className={
                            mine
                              ? "mw-teams-message-bubble mine"
                              : "mw-teams-message-bubble"
                          }
                        >
                          {message.direct_to_name && (
                            <Badge size="xs" color="red" variant="light" mb="xs">
                              Direct message
                            </Badge>
                          )}

                          {message.message_body !== "(attachment)" && (
                            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                              {message.message_body}
                            </Text>
                          )}

                          {message.attachments?.length > 0 && (
                            <Stack
                              gap="xs"
                              mt={
                                message.message_body !== "(attachment)"
                                  ? "sm"
                                  : 0
                              }
                            >
                              {message.attachments.map((attachment) =>
                                isImageAttachment(attachment) ? (
                                  <a
                                    key={attachment.id}
                                    href={attachment.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mw-chat-image-link"
                                  >
                                    <Image
                                      src={attachment.file_url}
                                      alt={attachment.file_name}
                                      radius="md"
                                      maw={420}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={attachment.id}
                                    href={attachment.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mw-chat-file-card"
                                  >
                                    <IconFile size={22} />

                                    <div>
                                      <strong>{attachment.file_name}</strong>
                                      <span>Open file</span>
                                    </div>
                                  </a>
                                )
                              )}
                            </Stack>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={messageEndRef} />
            </div>
          </ScrollArea>

          <div className="mw-teams-composer">
            {directToName && (
              <div className="mw-teams-direct-banner">
                <Text size="sm">
                  Sending directly to <strong>{directToName}</strong>
                </Text>

                <ActionIcon variant="subtle" color="gray" onClick={openTeamChat}>
                  <IconX size={16} />
                </ActionIcon>
              </div>
            )}

            {files.length > 0 && (
              <div className="mw-chat-file-preview-list">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="mw-chat-file-preview"
                  >
                    <IconFile size={18} />

                    <span>{file.name}</span>

                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => removeFile(index)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </div>
                ))}
              </div>
            )}

            <Textarea
              placeholder={
                directToName
                  ? `Message ${directToName}...`
                  : "Message the Metal Worx team..."
              }
              autosize
              minRows={3}
              maxRows={8}
              value={messageBody}
              onChange={(event) => setMessageBody(event.currentTarget.value)}
              onKeyDown={handleMessageKeyDown}
            />

            <Group justify="space-between" mt="sm">
              <Group gap="xs">
                <FileButton onChange={handleFiles} multiple>
                  {(props) => (
                    <Tooltip label="Attach files or images">
                      <ActionIcon
                        {...props}
                        variant="light"
                        color="gray"
                        size="lg"
                      >
                        <IconPaperclip size={19} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </FileButton>

                {!directToName &&
                  people
                    .filter((person) => person !== activeUser)
                    .map((person) => (
                      <Tooltip key={person} label={`Mention ${person}`}>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="gray"
                          leftSection={<IconAt size={14} />}
                          onClick={() => addMention(person)}
                        >
                          {person}
                        </Button>
                      </Tooltip>
                    ))}

                {directToName && (
                  <Badge
                    color="red"
                    variant="light"
                    leftSection={<IconMessageCircle size={12} />}
                  >
                    Direct Message
                  </Badge>
                )}
              </Group>

              <Button
                color="red"
                leftSection={<IconSend size={17} />}
                loading={sending}
                onClick={handleSend}
              >
                Send
              </Button>
            </Group>
          </div>
        </Card>
      </div>
    </>
  );
}

export default InternalChat;