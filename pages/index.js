import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Pusher from 'pusher-js';

function AnimatedMessage({ children, animate, direction = 'vertical' }) {
  const [showContent, setShowContent] = useState(!animate);
  const placeholderRef = useRef(null);
  const measureRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!animate) {
      setShowContent(true);
      return;
    }

    // Wait for next frame to ensure refs are ready and DOM is stable
    const setupRaf = requestAnimationFrame(() => {
      if (!isMountedRef.current || !placeholderRef.current || !measureRef.current) {
        setShowContent(true);
        return;
      }

      // ChatIS-style: pre-measure, animate spacer with jQuery "swing" equivalent, then swap in content
      const target = placeholderRef.current;
      const measure = measureRef.current;
      
      // Force layout recalculation for accurate measurement
      measure.offsetHeight;
      
      const targetHeight = measure.offsetHeight;
      const targetWidth = measure.offsetWidth;
      const marginBottom = 4; // Include the message's margin in animation

      // Ensure we have valid measurements
      if (targetHeight === 0 && targetWidth === 0) {
        setShowContent(true);
        return;
      }

      if (direction === 'vertical') {
        target.style.height = '0px';
        target.style.marginBottom = '0px';
        target.style.overflow = 'hidden';
      } else {
        target.style.width = '0px';
        target.style.height = `${targetHeight}px`;
        target.style.overflow = 'hidden';
      }

      let start;
      const duration = 150; // ms
      const swing = (t) => 0.5 - Math.cos(Math.PI * t) / 2; // jQuery "swing"
      
      const step = (ts) => {
        if (!isMountedRef.current) return;
        
        if (start == null) start = ts;
        const t = Math.min(1, (ts - start) / duration);
        const eased = swing(t);
        
        if (direction === 'vertical') {
          target.style.height = `${Math.round(targetHeight * eased)}px`;
          target.style.marginBottom = `${Math.round(marginBottom * eased)}px`;
        } else {
          target.style.width = `${Math.round(targetWidth * eased)}px`;
        }
        
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          if (isMountedRef.current) {
            setShowContent(true);
          }
        }
      };
      
      requestAnimationFrame(step);
    });

    return () => {
      cancelAnimationFrame(setupRaf);
    };
  }, [animate, direction, children]);

  const measureStyles = { visibility: 'hidden', position: 'absolute', pointerEvents: 'none' };

  return (
    <>
      <div ref={measureRef} style={measureStyles}>
        {children}
      </div>
      {showContent ? (
        <div style={{ marginBottom: '4px' }}>
          {children}
        </div>
      ) : (
        <div ref={placeholderRef} />
      )}
    </>
  );
}

function parseMessage(text, emoteMap = {}) {
  const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g;
  const parts = [];
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

  const finalParts = [];
  for (const part of parts) {
    if (part.type === 'text') {
      const words = part.content.split(/(\s+)/);
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

export default function Overlay() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [channelData, setChannelData] = useState(null);
  const [emoteMap, setEmoteMap] = useState({});
  const [settings, setSettings] = useState({ 
    channel: '',
    animation: 'slide',
    size: 3,
    font: 0,
    fontCustom: '',
    stroke: 0,
    shadow: 0,
    smallCaps: false,
    hideNames: false
  });

  // ChatIS-style message queue: collect messages and process them every 200ms
  const messageQueueRef = useRef([]);

  useEffect(() => {
    if (!router.isReady) return;
    const newChannel = router.query.channel || '';
    if (newChannel) {
      setSettings({
        channel: newChannel,
        animation: router.query.animation || 'slide',
        size: parseInt(router.query.size) || 3,
        font: parseInt(router.query.font) || 0,
        fontCustom: router.query.fontCustom || '',
        stroke: parseInt(router.query.stroke) || 0,
        shadow: parseInt(router.query.shadow) || 0,
        smallCaps: router.query.smallCaps === 'true',
        hideNames: router.query.hideNames === 'true'
      });
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!settings.channel) return;

    async function loadEmotes() {
      const newEmoteMap = {};
      
      try {
        try {
          const searchResponse = await fetch(
            `https://7tv.io/v3/gql`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: `
                  query SearchUsers($query: String!) {
                    users(query: $query) {
                      items {
                        id
                        username
                        display_name
                        connections {
                          id
                          platform
                          username
                          display_name
                        }
                      }
                    }
                  }
                `,
                variables: {
                  query: settings.channel
                }
              })
            }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const users = searchData?.data?.users?.items || [];
            
            let userId = null;
            for (const user of users) {
              const twitchConn = user.connections?.find(
                c => c.platform === 'TWITCH' && 
                     c.username.toLowerCase() === settings.channel.toLowerCase()
              );
              if (twitchConn) {
                userId = user.id;
                break;
              }
            }

            if (userId) {
              const userResponse = await fetch(`https://7tv.io/v3/users/${userId}`);
              if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData?.emote_set?.emotes) {
                  userData.emote_set.emotes.forEach(emote => {
                    const files = emote.data?.host?.files || [];
                    const webpFile = files.find(f => f.name === '4x.webp') || 
                                   files.find(f => f.name === '3x.webp') ||
                                   files[files.length - 1];
                    if (webpFile && emote.data?.host?.url) {
                      newEmoteMap[emote.name] = `https:${emote.data.host.url}/${webpFile.name}`;
                    }
                  });
                  console.log('Loaded 7TV emotes via GraphQL search:', Object.keys(newEmoteMap).length);
                }
              }
            }
          }
        } catch (e) {
          console.warn('7TV GraphQL search failed:', e);
        }

        if (Object.keys(newEmoteMap).length === 0) {
          try {
            const twitchResponse = await fetch(
              `https://api.ivr.fi/v2/twitch/user?login=${settings.channel}`
            );
            
            if (twitchResponse.ok) {
              const twitchData = await twitchResponse.json();
              const twitchId = twitchData?.[0]?.id;
              
              if (twitchId) {
                const stvResponse = await fetch(`https://7tv.io/v3/users/twitch/${twitchId}`);
                if (stvResponse.ok) {
                  const stvData = await stvResponse.json();
                  if (stvData?.emote_set?.emotes) {
                    stvData.emote_set.emotes.forEach(emote => {
                      const files = emote.data?.host?.files || [];
                      const webpFile = files.find(f => f.name === '4x.webp') || 
                                     files.find(f => f.name === '3x.webp') ||
                                     files[files.length - 1];
                      if (webpFile && emote.data?.host?.url) {
                        newEmoteMap[emote.name] = `https:${emote.data.host.url}/${webpFile.name}`;
                      }
                    });
                    console.log('Loaded 7TV emotes via Twitch ID:', Object.keys(newEmoteMap).length);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('7TV Twitch ID lookup failed:', e);
          }
        }

        try {
          const globalResponse = await fetch('https://7tv.io/v3/emote-sets/global');
          if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            if (globalData?.emotes) {
              globalData.emotes.forEach(emote => {
                if (!newEmoteMap[emote.name]) {
                  const files = emote.data?.host?.files || [];
                  const webpFile = files.find(f => f.name === '4x.webp') || 
                                 files.find(f => f.name === '3x.webp') ||
                                 files[files.length - 1];
                  if (webpFile && emote.data?.host?.url) {
                    newEmoteMap[emote.name] = `https:${emote.data.host.url}/${webpFile.name}`;
                  }
                }
              });
              console.log('Loaded 7TV global emotes');
            }
          }
        } catch (e) {
          console.warn('7TV global emotes failed:', e);
        }

        try {
          const bttvChannelResponse = await fetch(
            `https://api.betterttv.net/3/cached/users/twitch/${settings.channel}`
          );
          if (bttvChannelResponse.ok) {
            const bttvData = await bttvChannelResponse.json();
            [...(bttvData.channelEmotes || []), ...(bttvData.sharedEmotes || [])].forEach(emote => {
              if (!newEmoteMap[emote.code]) {
                newEmoteMap[emote.code] = `https://cdn.betterttv.net/emote/${emote.id}/3x`;
              }
            });
            console.log('Loaded BTTV emotes');
          }
        } catch (e) {
          console.warn('BTTV fetch failed:', e);
        }

        try {
          const bttvGlobalResponse = await fetch('https://api.betterttv.net/3/cached/emotes/global');
          if (bttvGlobalResponse.ok) {
            const bttvGlobal = await bttvGlobalResponse.json();
            bttvGlobal.forEach(emote => {
              if (!newEmoteMap[emote.code]) {
                newEmoteMap[emote.code] = `https://cdn.betterttv.net/emote/${emote.id}/3x`;
              }
            });
            console.log('Loaded BTTV global emotes');
          }
        } catch (e) {
          console.warn('BTTV global fetch failed:', e);
        }

        try {
          const ffzResponse = await fetch(
            `https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${settings.channel}`
          );
          if (ffzResponse.ok) {
            const ffzData = await ffzResponse.json();
            ffzData.forEach(emote => {
              if (!newEmoteMap[emote.code]) {
                const url = emote.images['4x'] || emote.images['2x'] || emote.images['1x'];
                if (url) newEmoteMap[emote.code] = url;
              }
            });
            console.log('Loaded FFZ emotes');
          }
        } catch (e) {
          console.warn('FFZ fetch failed:', e);
        }

        console.log('Total emotes loaded:', Object.keys(newEmoteMap).length);
        setEmoteMap(newEmoteMap);
        
      } catch (error) {
        console.error('Failed to load emotes:', error);
      }
    }

    loadEmotes();
  }, [settings.channel]);

  const emoteMapRef = useRef({});
  
  useEffect(() => {
    emoteMapRef.current = emoteMap;
  }, [emoteMap]);

  // ChatIS-style: Process message queue every 200ms
  // Key: Batch ALL queued messages together and animate them as ONE block
  useEffect(() => {
    const interval = setInterval(() => {
      if (messageQueueRef.current.length > 0) {
        const batch = [...messageQueueRef.current];
        messageQueueRef.current = []; // Clear queue BEFORE processing
        
        setMessages(prev => {
          // Mark which messages are in this batch for animation
          const batchWithFlag = batch.map((msg, idx) => ({
            ...msg,
            isInCurrentBatch: true,
            batchId: Date.now() // All messages in this batch share same ID
          }));
          const combined = [...prev, ...batchWithFlag];
          return combined.slice(-50);
        });
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!settings.channel) return;

    // Clear messages when channel changes
    setMessages([]);
    
    let pusher = null;
    let channel = null;

    async function connectToKick() {
      try {
        const response = await fetch(`https://kick.com/api/v2/channels/${settings.channel}`);
        const data = await response.json();
        setChannelData(data);

        pusher = new Pusher('32cbd69e4b950bf97679', { cluster: 'us2' });
        channel = pusher.subscribe(`chatrooms.${data.chatroom.id}.v2`);
        
        channel.bind('App\\Events\\ChatMessageEvent', (chatData) => {
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

          const newMessage = {
            id: chatData.id,
            username: chatData.sender.username,
            color: chatData.sender.identity.color || '#999999',
            messageParts: parseMessage(chatData.content, emoteMapRef.current),
            badges: badgeElements,
            timestamp: Date.now()
          };

          // ChatIS-style: Add to queue instead of directly to state
          messageQueueRef.current.push(newMessage);
        });

      } catch (error) {
        console.error('Failed to connect to Kick:', error);
      }
    }

    connectToKick();

    // Proper cleanup function
    return () => {
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
      if (pusher) {
        pusher.disconnect();
      }
    };
  }, [settings.channel]);

  const sizeMap = {
    1: { emoteHeight: 25 },
    2: { emoteHeight: 42 },
    3: { emoteHeight: 60 }
  };

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

  const getStrokeStyle = (thickness) => {
    if (!thickness) return {};
    const widths = { 1: 1, 2: 2, 3: 3, 4: 4 };
    return {
      paintOrder: 'stroke fill',
      WebkitTextStroke: `${widths[thickness]}px black`
    };
  };

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
    lineHeight: '1.3',
    fontWeight: 800,
    ...getStrokeStyle(settings.stroke),
    ...(settings.shadow && { filter: getShadowStyle(settings.shadow) }),
    ...(settings.smallCaps && { fontVariant: 'small-caps' })
  };

  const currentSize = sizeMap[settings.size] || sizeMap[3];
  const badgeSize = currentSize.emoteHeight * 0.75;

  return (
    <>
      <Head><title>Kick Chat Overlay - {settings.channel}</title></Head>
      <div className="min-h-screen w-full">
        <div 
          className="absolute bottom-0 left-0 w-full overflow-hidden text-white"
          style={{
            ...containerStyle,
            width: 'calc(100% - 20px)',
            padding: '10px'
          }}
        >
          {(() => {
            // ChatIS-style: Group messages by batch and animate entire batches together
            const batches = [];
            let currentBatch = [];
            let currentBatchId = null;

            messages.forEach((msg, index) => {
              if (msg.isInCurrentBatch && msg.batchId !== currentBatchId) {
                if (currentBatch.length > 0) {
                  batches.push({ messages: currentBatch, animate: false });
                }
                currentBatch = [msg];
                currentBatchId = msg.batchId;
              } else if (msg.isInCurrentBatch && msg.batchId === currentBatchId) {
                currentBatch.push(msg);
              } else {
                if (currentBatch.length > 0) {
                  batches.push({ messages: currentBatch, animate: currentBatchId !== null });
                  currentBatch = [];
                  currentBatchId = null;
                }
                batches.push({ messages: [msg], animate: false });
              }
            });

            if (currentBatch.length > 0) {
              batches.push({ messages: currentBatch, animate: currentBatchId !== null && settings.animation === 'slide' });
            }

            return batches.map((batch, batchIdx) => (
              <AnimatedMessage key={batch.messages[0].batchId || batch.messages[0].id} animate={batch.animate}>
                <>
                  {batch.messages.map((msg) => (
                    <div key={msg.id} style={{ 
                      wordWrap: 'break-word',
                      marginBottom: '4px'
                    }}>
                {msg.badges?.length > 0 && (
                  <>
                    {msg.badges.map((badge, i) => (
                      <img 
                        key={i} 
                        src={badge.url} 
                        alt="badge"
                        style={{
                          height: `${badgeSize}px`,
                          verticalAlign: 'middle',
                          borderRadius: '10%',
                          marginRight: '4px',
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
                    <span>: </span>
                  </>
                )}
                <span>
                  {msg.messageParts.map((part, i) => 
                    part.type === 'emote' ? (
                      <span 
                        key={i}
                        style={{
                          display: 'inline-block',
                          verticalAlign: 'middle',
                          lineHeight: 0,
                          margin: '0 2px'
                        }}
                      >
                        <img 
                          src={part.url}
                          alt={part.name}
                          style={{
                            height: `${currentSize.emoteHeight}px`,
                            display: 'inline-block',
                            verticalAlign: 'middle'
                          }}
                        />
                      </span>
                    ) : (
                      <span key={i}>{part.content}</span>
                    )
                  )}
                    </span>
                    </div>
                  ))}
                </>
              </AnimatedMessage>
            ));
          })()}
        </div>
      </div>
    </>
  );
}
