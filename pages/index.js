import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Pusher from 'pusher-js';

function parseMessage(text, channelEmotes = {}) {
  const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = emoteRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index);
      parts.push({ type: 'text', content: textPart });
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

  const finalParts = [];
  for (const part of parts) {
    if (part.type === 'text') {
      const words = part.content.split(/(\s+)/);
      for (const word of words) {
        if (channelEmotes[word]) {
          finalParts.push({
            type: 'emote',
            name: word,
            url: channelEmotes[word]
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

export default function Overlay() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [channelData, setChannelData] = useState(null);
  const [channelEmotes, setChannelEmotes] = useState({});
  const [settings, setSettings] = useState({
    channel: 'xqc',
    animation: 'slide',
    size: 3,
    font: 0,
    fontCustom: '',
    stroke: 0,
    shadow: 0,
    smallCaps: false,
    hideNames: false
  });

  useEffect(() => {
    if (!router.isReady) return;
    setSettings({
      channel: router.query.channel || 'xqc',
      animation: router.query.animation || 'slide',
      size: parseInt(router.query.size) || 3,
      font: parseInt(router.query.font) || 0,
      fontCustom: router.query.fontCustom || '',
      stroke: parseInt(router.query.stroke) || 0,
      shadow: parseInt(router.query.shadow) || 0,
      smallCaps: router.query.smallCaps === 'true',
      hideNames: router.query.hideNames === 'true'
    });
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!settings.channel) return;

    async function fetchEmotes() {
      const emotes = {};

      try {
        const [sevenTV, bttv, ffz] = await Promise.all([
          fetch(`https://7tv.io/v3/users/twitch/${settings.channel}`).then(res => res.json()),
          fetch(`https://api.betterttv.net/3/cached/users/twitch/${settings.channel}`).then(res => res.json()),
          fetch(`https://api.frankerfacez.com/v1/room/${settings.channel}`).then(res => res.json())
        ]);

        if (sevenTV.emote_set?.emotes) {
          sevenTV.emote_set.emotes.forEach(emote => {
            emotes[emote.name] = `https://cdn.7tv.app/emote/${emote.id}/4x.webp`;
          });
        }

        if (bttv.channelEmotes) {
          bttv.channelEmotes.forEach(emote => {
            emotes[emote.code] = `https://cdn.betterttv.net/emote/${emote.id}/3x`;
          });
        }

        if (bttv.sharedEmotes) {
          bttv.sharedEmotes.forEach(emote => {
            emotes[emote.code] = `https://cdn.betterttv.net/emote/${emote.id}/3x`;
          });
        }

        if (ffz.sets) {
          Object.values(ffz.sets).forEach(set => {
            set.emoticons.forEach(emote => {
              emotes[emote.name] = `https:${emote.urls['4'] || emote.urls['2']}`;
            });
          });
        }

        setChannelEmotes(emotes);
      } catch (error) {
        console.error('Failed to fetch emotes:', error);
      }
    }

    async function connectToKick() {
      try {
        const response = await fetch(`https://kick.com/api/v2/channels/${settings.channel}`);
        const data = await response.json();
        setChannelData(data);

        const pusher = new Pusher('32cbd69e4b950bf97679', { cluster: 'us2' });
        const channel = pusher.subscribe(`chatrooms.${data.chatroom.id}.v2`);

        channel.bind('App\\\\Events\\\\ChatMessageEvent', (chatData) => {
          const newMessage = {
            id: chatData.id,
            username: chatData.sender.username,
            color: chatData.sender.identity.color || '#999999',
            messageParts: parseMessage(chatData.content, channelEmotes),
            badges: [],
            timestamp: Date.now()
          };
          setMessages(prev => [...prev.slice(-49), newMessage]);
        });

        return () => {
          channel.unbind_all();
          channel.unsubscribe();
          pusher.disconnect();
        };
      } catch (error) {
        console.error('Failed to connect to Kick:', error);
      }
    }

    fetchEmotes();
    connectToKick();
  }, [settings.channel]);

  return <div>Overlay Component</div>;
}
