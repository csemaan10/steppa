// Per-device "last read" marker for each group chat, used for the unread dot.

const key = (groupId: string) => `steppa:chat-read:${groupId}`;

/** Id of the newest message seen in this group's chat on this device (0 if never opened). */
export function getLastRead(groupId: string): number {
  try {
    return Number(localStorage.getItem(key(groupId))) || 0;
  } catch {
    return 0;
  }
}

/** Records that messages up to `messageId` have been seen. Never moves backwards. */
export function markRead(groupId: string, messageId: number): void {
  try {
    if (messageId > getLastRead(groupId)) localStorage.setItem(key(groupId), String(messageId));
  } catch {
    // Storage unavailable: the dot just shows again next time.
  }
}
