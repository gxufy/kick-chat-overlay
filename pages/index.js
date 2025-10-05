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
      const timer = setTimeout(() => setIsAnimating(false), 150);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  if (!animate) return <>{children}</>;
  if (isAnimating) {
    return (
      <>
        <div ref={auxRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>{children}</div>
        <div ref={animRef} style={{ height: '0px', overflow: 'hidden', transition: 'height 150ms ease-in-out' }} />
      </>
    );
  }
  return <>{children}</>;
}

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [channelData, setChannelData] = useState(null);
  const [badgeMap, setBadgeMap] = useState({});
  const [settings, setSettings] = useState({ 
    channel: 'xqc',
    animation: 'slide', 
    textSize: 'medium', 
    textShadow: 'small' 
  });

  useEffect(() => {
    if (!router.isReady) return;
    setSettings({
      channel: router.query.channel || 'xqc',
      animation: router.query.animation || 'slide',
      textSize: router.query.textSize || 'medium',
      textShadow: router.query.textShadow || 'small'
    });
  }, [router.isReady, router.query]);

  // Fetch badges
  useEffect(() => {
    if (!channelData) return;
    
    async function fetchBadges() {
      try {
        const response = await fetch(`https://kick.com/api/v2/channels/${channelData.slug}/badges`);
        const data = await response.json();
        
        const badges = {
          broadcaster: 'https://files.kick.com/badges/broadcaster.svg',
          moderator: 'https://files.kick.com/badges/moderator.svg',
          vip: 'https://files.kick.com/badges/vip.svg',
          verified: 'https://files.kick.com/badges/verified.svg',
          staff: 'https://files.kick.com/badges/staff.svg',
          founder: 'https://files.kick.com/badges/founder.svg',
          og: 'https://files.kick.com/badges/og.svg',
        };

        // Add subscriber badges
        if (channelData.subscriber_badges) {
          channelData.subscriber_badges.forEach(badge => {
            badges[`subscriber_${badge.months}`] = badge.badge_image.src;
          });
        }

        setBadgeMap(badges);
      } catch (error) {
        console.error('Failed to fetch badges:', error);
      }
    }

    fetchBadges();
  }, [channelData]);

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
          const badges = [];
          
          if (chatData.sender.identity.badges) {
            chatData.sender.identity.badges.forEach(badge => {
              if (badge.type === 'subscriber') {
                badges.push({
                  type: 'subscriber',
                  url: data.subscriber_badges?.find(b => b.months <= badge.count)?.badge_image.src || 'https://files.kick.com/badges/subscriber.svg'
                });
              } else {
                badges.push({
                  type: badge.type,
                  url: `https://files.kick.com/badges/${badge.type}.svg`
                });
              }
            });
          }

          const newMessage = {
            id: chatData.id,
            username: chatData.sender.username,
            color: chatData.sender.identity.color || '#999999',
            text: chatData.content,
            badges: badges,
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
  }, [settings.channel]);

  const sizeClasses = { small: 'text-base', medium: 'text-lg', large: 'text-xl' };
  const shadowClasses = { none: '', small: 'text-shadow-sm', medium: 'text-shadow-md', large: 'text-shadow-lg' };

  return (
    <>
      <Head><title>Kick Chat Overlay - {settings.channel}</title></Head>
      <div className="min-h-screen w-full">
        <div className={`absolute bottom-0 left-0 w-full overflow-hidden ${sizeClasses[settings.textSize]} text-white`}>
          {messages.map((msg, index) => (
            <AnimatedMessage key={msg.id} animate={settings.animation === 'slide' && index === messages.length - 1}>
              <div className="m-1">
                {msg.badges?.map((badge, i) => (
                  <img 
                    key={i} 
                    src={badge.url} 
                    alt={badge.type}
                    className="inline-block h-4 w-auto mr-1"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                ))}
                <span className={`font-bold ${shadowClasses[settings.textShadow]}`} style={{ color: msg.color }}>
                  {msg.username}
                </span>
                <span className={shadowClasses[settings.textShadow]}>: </span>
                <span className={`break-words ${shadowClasses[settings.textShadow]}`}>
                  {msg.text}
                </span>
              </div>
            </AnimatedMessage>
          ))}
        </div>
      </div>
    </>
  );
}
