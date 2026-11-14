// Links for sharing a meeting through other apps. Each takes the room link and the text to send with it.

export const meetingLink = (meetingId: string) => `${window.location.origin}/room/${meetingId}`;

export const whatsAppShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const telegramShareUrl = (link: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

export const emailShareUrl = (subject: string, body: string) =>
  `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
