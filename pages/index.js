import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Pusher from 'pusher-js';

function AnimatedMessage({ children, animate }) {
  const [isAnimating, setIsAnimating] = useState(animate);
  const auxRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (animate && auxRef.current) {
      const measuredHeight = auxRef.current.offsetHeight;
      requestAnimationFrame(() => {
        if (animRef.current) {
          animRef.current.style.height = measuredHeight + 'px';
        }
      });
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  if (!animate) return <>{children}</>;
  if (isAnimating) {
    return (
      <>
        <div ref={auxRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>{children}</div>
        <div ref={animRef} style={{ height: '0px', overflow: 'hidden', transition: 'height 300ms ease-out' }} />
      </>
    );
  }
  return <>{children}</>;
}

function parseMessage(text, channelEmotes = {}) {
  const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  // First, handle Kick's [emote:id:name] format
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

  // Then, handle plain text emotes (7TV, BTTV, FFZ)
  const finalParts = [];
  for (const part of parts) {
    if (part.type === 'text') {
      const words = part.content.split(/(\s+)/);
      for (const word of words) {
        if (word.trim() && channelEmotes[word]) {
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
  const channelEmotesRef = useRef({});
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

  // Keep ref in sync with state
  useEffect(() => {
    channelEmotesRef.current = channelEmotes;
  }, [channelEmotes]);

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

    let pusherInstance = null;
    let channelInstance = null;

    async function loadEmotes(channelSlug) {
      const emotes = {};
      
      try {
        console.log('[Kick Overlay] Loading emotes for:', channelSlug);
        
        // Load 7TV GLOBAL emotes (Kick-specific emotes don't work reliably)
        try {
          const stvGlobalResponse = await fetch('https://7tv.io/v3/emote-sets/global');
          if (stvGlobalResponse.ok) {
            const stvGlobalData = await stvGlobalResponse.json();
            console.log('[Kick Overlay] 7TV global data:', stvGlobalData);
            
            if (stvGlobalData.emotes) {
              stvGlobalData.emotes.forEach(emote => {
                const webpFiles = emote.data.host.files.filter(f => f.format === 'WEBP');
                const maxSize = webpFiles[webpFiles.length - 1]?.name || '4x.webp';
                const emoteUrl = `https:${emote.data.host.url}/${maxSize}`;
                emotes[emote.name] = emoteUrl;
                console.log('[Kick Overlay] Added 7TV global emote:', emote.name);
              });
            }
          }
        } catch (e) {
          console.warn('[Kick Overlay] 7TV global loading failed:', e);
        }

        // Try loading channel-specific 7TV (might not work for Kick)
        try {
          const stvResponse = await fetch(`https://7tv.io/v3/users/kick/${channelSlug}`);
          if (stvResponse.ok) {
            const stvData = await stvResponse.json();
            
            if (stvData.emote_set?.emotes) {
              stvData.emote_set.emotes.forEach(emote => {
                const webpFiles = emote.data.host.files.filter(f => f.format === 'WEBP');
                const maxSize = webpFiles[webpFiles.length - 1]?.name || '4x.webp';
                const emoteUrl = `https:${emote.data.host.url}/${maxSize}`;
                emotes[emote.name] = emoteUrl;
                console.log('[Kick Overlay] Added 7TV channel emote:', emote.name);
              });
            }
          }
        } catch (e) {
          console.warn('[Kick Overlay] 7TV channel loading failed (expected for Kick):', e);
        }

        // Load BTTV emotes
        try {
          const bttvResponse = await fetch(`https://api.betterttv.net/3/cached/users/kick/${channelSlug}`);
          if (bttvResponse.ok) {
            const bttvData = await bttvResponse.json();
            [...(bttvData.channelEmotes || []), ...(bttvData.sharedEmotes || [])].forEach(emote => {
              emotes[emote.code] = `https://cdn.betterttv.net/emote/${emote.id}/3x`;
              console.log('[Kick Overlay] Added BTTV emote:', emote.code);
            });
          }
        } catch (e) {
          console.warn('[Kick Overlay] BTTV loading failed:', e);
        }

        // Load FFZ emotes
        try {
          const ffzResponse = await fetch(`https://api.betterttv.net/3/cached/frankerfacez/users/kick/${channelSlug}`);
          if (ffzResponse.ok) {
            const ffzData = await ffzResponse.json();
            if (Array.isArray(ffzData)) {
              ffzData.forEach(emote => {
                const imageUrl = emote.images['4x'] || emote.images['2x'] || emote.images['1x'];
                emotes[emote.code] = imageUrl;
                console.log('[Kick Overlay] Added FFZ emote:', emote.code);
              });
            }
          }
        } catch (e) {
          console.warn('[Kick Overlay] FFZ loading failed:', e);
        }
      } catch (error) {
        console.error('[Kick Overlay] Error loading emotes:', error);
      }

      console.log('[Kick Overlay] Total emotes loaded:', Object.keys(emotes).length);
      setChannelEmotes(emotes);
      channelEmotesRef.current = emotes;
    }

    async function connectToKick() {
      try {
        const response = await fetch(`https://kick.com/api/v2/channels/${settings.channel}`);
        if (!response.ok) {
          console.error('[Kick Overlay] Channel not found:', settings.channel);
          return;
        }
        const data = await response.json();
        console.log('[Kick Overlay] Connected to:', data.slug, 'Chatroom ID:', data.chatroom.id);
        setChannelData(data);

        // Load emotes FIRST
        await loadEmotes(data.slug);

        pusherInstance = new Pusher('32cbd69e4b950bf97679', { cluster: 'us2' });
        channelInstance = pusherInstance.subscribe(`chatrooms.${data.chatroom.id}.v2`);
        
        channelInstance.bind('App\\Events\\ChatMessageEvent', (chatData) => {
          const badgeElements = [];
          
          if (chatData.sender?.identity?.badges && Array.isArray(chatData.sender.identity.badges)) {
            chatData.sender.identity.badges.forEach(badge => {
              if (badge.type === 'subscriber') {
                if (data.subscriber_badges && data.subscriber_badges.length > 0) {
                  const matchingBadges = data.subscriber_badges
                    .filter(b => badge.count >= b.months)
                    .sort((a, b) => b.months - a.months);
                  
                  if (matchingBadges.length > 0 && matchingBadges[0].badge_image?.src) {
                    badgeElements.push({ url: matchingBadges[0].badge_image.src });
                  }
                }
              } else if (badge.type === 'sub_gifter') {
                let gifterBadge = 'subGifter';
                if (badge.count >= 200) gifterBadge = 'subGifter200';
                else if (badge.count >= 100) gifterBadge = 'subGifter100';
                else if (badge.count >= 50) gifterBadge = 'subGifter50';
                else if (badge.count >= 25) gifterBadge = 'subGifter25';
                
                badgeElements.push({ url: `/badges/${gifterBadge}.svg` });
              } else {
                badgeElements.push({ url: `/badges/${badge.type}.svg` });
              }
            });
          }

          // Use ref to get current emotes
          const currentEmotes = channelEmotesRef.current;
          
          const newMessage = {
            id: chatData.id,
            username: chatData.sender.username,
            color: chatData.sender.identity.color || '#999999',
            messageParts: parseMessage(chatData.content, currentEmotes),
            badges: badgeElements,
            timestamp: Date.now()
          };

          setMessages(prev => [...prev.slice(-49), newMessage]);
        });
      } catch (error) {
        console.error('[Kick Overlay] Failed to connect:', error);
      }
    }

    connectToKick();

    return () => {
      if (channelInstance) {
        channelInstance.unbind_all();
        channelInstance.unsubscribe();
      }
      if (pusherInstance) {
        pusherInstance.disconnect();
      }
    };
  }, [settings.channel]);

  // Size classes (1=small, 2=medium, 3=large)
  const sizeMap = {
    1: { container: 'text-2xl', emote: 'max-h-[25px]' },
    2: { container: 'text-4xl', emote: 'max-h-[42px]' },
    3: { container: 'text-5xl', emote: 'max-h-[60px]' }
  };

  // Font families (0-11 + custom)
  const fontMap = {
    0: "'Baloo Thambi', cursive",
    1: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    2: "'Roboto', sans-serif",
    3: "'Lato', sans-serif",
    4: "'Noto Sans', sans-serif",
    5: "'Source Code Pro', monospace",
    6: "'Impact', fantasy",
    7: "'Comfortaa', cursive",
    8: "'Dancing Script', cursive",
    9: "'Indie Flower', cursive",
    10: "'Open Sans', sans-serif",
    11: "'Alsina Ultrajada', fantasy"
  };

  // Stroke thickness (1=thin, 2=medium, 3=thick, 4=thicker)
  const getStrokeStyle = (thickness) => {
    if (!thickness) return {};
    const widths = { 1: 1, 2: 2, 3: 3, 4: 4 };
    return {
      paintOrder: 'stroke fill',
      WebkitTextStroke: `${widths[thickness]}px black`
    };
  };

  // Shadow size (1=small, 2=medium, 3=large)
  const getShadowStyle = (size) => {
    if (!size) return '';
    const shadows = {
      1: 'drop-shadow(1px 1px 0.3rem black)',
      2: 'drop-shadow(2px 2px 0.5rem black)',
      3: 'drop-shadow(3px 3px 0.7rem black)'
    };
    return shadows[size];
  };

  const containerStyle = {
    fontFamily: settings.fontCustom || fontMap[settings.font] || fontMap[0],
    fontSize: '48px',
    lineHeight: '75px',
    fontWeight: 800,
    ...getStrokeStyle(settings.stroke),
    ...(settings.shadow && { filter: getShadowStyle(settings.shadow) }),
    ...(settings.smallCaps && { fontVariant: 'small-caps' })
  };

  const currentSize = sizeMap[settings.size] || sizeMap[3];

  return (
    <>
      <Head><title>Kick Chat Overlay - {settings.channel}</title></Head>
      <div className="min-h-screen w-full">
        <div 
          className={`absolute bottom-0 left-0 w-full overflow-hidden text-white`}
          style={{
            ...containerStyle,
            width: 'calc(100% - 20px)',
            padding: '10px'
          }}
        >
          {messages.map((msg, index) => (
            <AnimatedMessage key={msg.id} animate={settings.animation === 'slide' && index === messages.length - 1}>
              <div style={{ lineHeight: '75px' }}>
                <span style={{ display: 'inline' }}>
                  {msg.badges?.length > 0 && (
                    <>
                      {msg.badges.map((badge, i) => (
                        <img 
                          key={i} 
                          src={badge.url} 
                          alt="badge"
                          style={{
                            width: '40px',
                            height: '40px',
                            verticalAlign: 'middle',
                            borderRadius: '10%',
                            marginRight: i === msg.badges.length - 1 ? '8px' : '5px',
                            marginBottom: '8px',
                            display: 'inline-block'
                          }}
                        />
                      ))}
                    </>
                  )}
                  {!settings.hideNames && (
                    <>
                      <span style={{ color: msg.color }}>
                        {msg.username}
                      </span>
                      <span className="colon">: </span>
                    </>
                  )}
                  <span style={{ wordBreak: 'break-word' }}>
                    {msg.messageParts.map((part, i) => 
                      part.type === 'emote' ? (
                        <img 
                          key={i}
                          src={part.url}
                          alt={part.name}
                          className={`inline-flex ${currentSize.emote} h-auto w-auto pr-1`}
                        />
                      ) : (
                        <span key={i}>{part.content}</span>
                      )
                    )}
                  </span>
                </span>
              </div>
            </AnimatedMessage>
          ))}
        </div>
      </div>
    </>
  );
}
