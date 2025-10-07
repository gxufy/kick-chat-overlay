import { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';

interface EmoteMap {
  [key: string]: string;
}

interface MessagePart {
  type: 'text' | 'emote';
  content?: string;
  url?: string;
  name?: string;
  id?: string;
}

interface Badge {
  url: string;
}

interface Message {
  id: string;
  username: string;
  color: string;
  messageParts: MessagePart[];
  badges: Badge[];
  timestamp: number;
}

function parseMessage(text: string, emoteMap: EmoteMap = {}): MessagePart[] {
  const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g;
  const parts: MessagePart[] = [];
  let lastIndex = 0;
  let match;

  while ((match = emoteRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'emote',
      id: match[1],
      name: match[2],
      url: `https://files.kick.com/emotes/${match[1]}/fullsize`
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  const finalParts: MessagePart[] = [];
  for (const part of parts) {
    if (part.type === 'text') {
      const words = part.content!.split(/(\s+)/);
      for (const word of words) {
        if (emoteMap[word]) {
          finalParts.push({
            type: 'emote',
            name: word,
            url: emoteMap[word]
          });
        } else {
          finalParts.push({ type: 'text', content: word });
        }
      }
    } else {
      finalParts.push(part);
    }
  }

  return finalParts.length > 0 ? finalParts : [{ type: 'text', content: text }];
}

function ChatMessage({ message, emoteHeight, badgeSize }: { message: Message; emoteHeight: number; badgeSize: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      marginBottom: '8px',
      flexWrap: 'nowrap',
      minWidth: 0
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        marginRight: '8px'
      }}>
        {message.badges.map((badge, i) => (
          <img
            key={i}
            src={badge.url}
            alt="badge"
            style={{
              height: `${badgeSize}px`,
              width: 'auto',
              marginRight: '4px',
              flexShrink: 0
            }}
          />
        ))}
        <span style={{ color: message.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {message.username}:
        </span>
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        minWidth: 0,
        flex: 1,
        lineHeight: `${emoteHeight}px`
      }}>
        {message.messageParts.map((part, i) =>
          part.type === 'emote' ? (
            <img
              key={i}
              src={part.url}
              alt={part.name}
              style={{
                height: `${emoteHeight}px`,
                width: 'auto',
                margin: '0 2px',
                verticalAlign: 'middle',
                display: 'inline-block'
              }}
            />
          ) : (
            <span key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {part.content}
            </span>
          )
        )}
      </div>
    </div>
  );
}

export default function Overlay() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [emoteMap, setEmoteMap] = useState<EmoteMap>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const emoteMapRef = useRef<EmoteMap>({});
  const channel = new URLSearchParams(window.location.search).get('channel') || 'xqc';

  useEffect(() => {
    emoteMapRef.current = emoteMap;
  }, [emoteMap]);

  useEffect(() => {
    async function loadEmotes() {
      const newEmoteMap: EmoteMap = {};

      try {
        const searchResponse = await fetch('https://7tv.io/v3/gql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query SearchUsers($query: String!) {
                users(query: $query) {
                  items {
                    id
                    username
                    connections {
                      platform
                      username
                    }
                  }
                }
              }
            `,
            variables: { query: channel }
          })
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const users = searchData?.data?.users?.items || [];

          const user = users.find((u: any) =>
            u.connections?.some((c: any) =>
              c.platform === 'TWITCH' && c.username.toLowerCase() === channel.toLowerCase()
            )
          );

          if (user) {
            const userResponse = await fetch(`https://7tv.io/v3/users/${user.id}`);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              userData?.emote_set?.emotes?.forEach((emote: any) => {
                const files = emote.data?.host?.files || [];
                const webpFile = files.find((f: any) => f.name === '3x.webp') || files[files.length - 1];
                if (webpFile && emote.data?.host?.url) {
                  newEmoteMap[emote.name] = `https:${emote.data.host.url}/${webpFile.name}`;
                }
              });
            }
          }
        }

        const globalResponse = await fetch('https://7tv.io/v3/emote-sets/global');
        if (globalResponse.ok) {
          const globalData = await globalResponse.json();
          globalData?.emotes?.forEach((emote: any) => {
            if (!newEmoteMap[emote.name]) {
              const files = emote.data?.host?.files || [];
              const webpFile = files.find((f: any) => f.name === '3x.webp') || files[files.length - 1];
              if (webpFile && emote.data?.host?.url) {
                newEmoteMap[emote.name] = `https:${emote.data.host.url}/${webpFile.name}`;
              }
            }
          });
        }

        const bttvResponse = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channel}`);
        if (bttvResponse.ok) {
          const bttvData = await bttvResponse.json();
          [...(bttvData.channelEmotes || []), ...(bttvData.sharedEmotes || [])].forEach((emote: any) => {
            if (!newEmoteMap[emote.code]) {
              newEmoteMap[emote.code] = `https://cdn.betterttv.net/emote/${emote.id}/3x`;
            }
          });
        }

        const bttvGlobalResponse = await fetch('https://api.betterttv.net/3/cached/emotes/global');
        if (bttvGlobalResponse.ok) {
          const bttvGlobal = await bttvGlobalResponse.json();
          bttvGlobal.forEach((emote: any) => {
            if (!newEmoteMap[emote.code]) {
              newEmoteMap[emote.code] = `https://cdn.betterttv.net/emote/${emote.id}/3x`;
            }
          });
        }

        setEmoteMap(newEmoteMap);
      } catch (error) {
        console.error('Failed to load emotes:', error);
      }
    }

    loadEmotes();
  }, [channel]);

  useEffect(() => {
    let pusher: Pusher | null = null;
    let chatChannel: any = null;

    async function connectToKick() {
      try {
        const response = await fetch(`https://kick.com/api/v2/channels/${channel}`);
        const data = await response.json();

        pusher = new Pusher('32cbd69e4b950bf97679', { cluster: 'us2' });
        chatChannel = pusher.subscribe(`chatrooms.${data.chatroom.id}.v2`);

        chatChannel.bind('App\\Events\\ChatMessageEvent', (chatData: any) => {
          const badgeElements: Badge[] = [];

          chatData.sender?.identity?.badges?.forEach((badge: any) => {
            if (badge.type === 'subscriber') {
              const matchingBadges = data.subscriber_badges
                ?.filter((b: any) => badge.count >= b.months)
                .sort((a: any, b: any) => b.months - a.months);

              if (matchingBadges?.[0]?.badge_image?.src) {
                badgeElements.push({ url: matchingBadges[0].badge_image.src });
              }
            } else {
              badgeElements.push({ url: `/badges/${badge.type}.svg` });
            }
          });

          const newMessage: Message = {
            id: chatData.id,
            username: chatData.sender.username,
            color: chatData.sender.identity.color || '#999999',
            messageParts: parseMessage(chatData.content, emoteMapRef.current),
            badges: badgeElements,
            timestamp: Date.now()
          };

          setMessages(prev => {
            const updated = [...prev, newMessage];
            return updated.slice(-30);
          });
        });
      } catch (error) {
        console.error('Failed to connect to Kick:', error);
      }
    }

    connectToKick();

    return () => {
      if (chatChannel) {
        chatChannel.unbind_all();
        chatChannel.unsubscribe();
      }
      if (pusher) {
        pusher.disconnect();
      }
    };
  }, [channel]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const emoteHeight = 60;
  const badgeSize = 45;

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      pointerEvents: 'none',
      overflow: 'hidden'
    }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          right: '20px',
          maxHeight: '80vh',
          overflow: 'hidden',
          fontFamily: "'Baloo Thambi', cursive",
          fontSize: '48px',
          fontWeight: 800,
          color: 'white',
          textShadow: '3px 3px 6px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}
      >
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            emoteHeight={emoteHeight}
            badgeSize={badgeSize}
          />
        ))}
      </div>
    </div>
  );
}
