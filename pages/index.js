
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Pusher from 'pusher-js';
import planck from 'planck-js';

function parseMessage(text, channelEmotes = {}) {
  const words = text.split(/(\s+)/);
  return words.map((word, i) => {
    if (channelEmotes[word]) {
      return { type: 'emote', name: word, url: channelEmotes[word] };
    } else {
      return { type: 'text', content: word };
    }
  });
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

    fetchEmotes();
  }, [settings.channel]);

  useEffect(() => {
    if (!settings.channel) return;

    async function connectToKick() {
      try {
        const response = await fetch(`https://kick.com/api/v2/channels/${settings.channel}`);
        const data = await response.json();
        setChannelData(data);

        const pusher = new Pusher('32cbd69e4b950bf97679', { cluster: 'us2' });
        const channel = pusher.subscribe(`chatrooms.${data.chatroom.id}.v2`);

        channel.bind('App\\Events\\ChatMessageEvent', (chatData) => {
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

    connectToKick();
  }, [settings.channel, channelEmotes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pl = planck, Vec2 = pl.Vec2;
    const gravity = Vec2(0, -10);
    const world = pl.World(gravity);

    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        let box = world.createBody().setDynamic();
        box.createFixture(pl.Box(0.5, 0.5));
        box.setPosition(Vec2(i * 1, -j * 1 + 20));
        box.setMassData({ mass: 1, center: Vec2(), I: 1 });
      }
    }

    const canvas = document.getElementById('jchatCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let body = world.getBodyList(); body; body = body.getNext()) {
        for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
          const shape = fixture.getShape();
          const pos = body.getPosition();
          const angle = body.getAngle();

          if (shape.getType() === 'polygon') {
            const vertices = shape.m_vertices.map(v => {
              const rotated = pl.Vec2.rotate(v, angle);
              return {
                x: (pos.x + rotated.x) * 30,
                y: canvas.height - (pos.y + rotated.y) * 30
              };
            });

            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
              ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fill();
          }
        }
      }
      world.step(1 / 60);
      requestAnimationFrame(render);
    }

    render();
  }, []);

  return (
    <>
      <Head><title>Kick Chat Overlay - {settings.channel}</title></Head>
      <canvas id="jchatCanvas" width="800" height="600" style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}></canvas>
      <div style={{ position: 'relative', zIndex: 1, color: 'white', padding: '10px' }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            <span style={{ color: msg.color }}>{msg.username}:</span>{' '}
            {msg.messageParts.map((part, i) =>
              part.type === 'emote' ? (
                <img key={i} src={part.url} alt={part.name} style={{ height: '32px', verticalAlign: 'middle' }} />
              ) : (
                <span key={i}>{part.content}</span>
              )
            )}
          </div>
        ))}
      </div>
    </>
  );
}
