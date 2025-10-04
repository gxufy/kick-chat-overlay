import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Pusher from 'pusher-js';

// AnimatedMessage component stays the same...
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

      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [animate]);

  if (!animate) return <>{children}</>;

  if (isAnimating) {
    return (
      <>
        <div ref={auxRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
          {children}
        </div>
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
  const [settings, setSettings] = useState({ 
    channel: 'xqc',
    animation: 'slide', 
    textSize: 'medium', 
    textShadow: 'small' 
  });

  // Parse URL parameters
  useEffect(() => {
    if (!router.isReady) return;
    setSettings({
      channel: router.query.channel || 'xqc',
      animation: router.query.animation || 'slide',
      textSize: router.query.textSize || 'medium',
      textShadow: router.query.textShadow || 'small'
    });
  }, [router.isReady, router.query]);

  // Fetch Kick channel data and connect to chat
  useEffect(() => {
    if (!settings.channel) return;

    async function connectToKick() {
      try {
        // Get channel info
        const response = await fetch(`https://kick.com/api/v2/channels/${settings.channel}`);
        const data = await response.json();
        setChannelData(data);

        // Connect to Pusher (Kick's chat service)
        const pusher = new Pusher('32cbd69e4b950bf97679', {
          cluster: 'us2'
        });

        const channel = pusher.subscribe(`chatrooms.${data.chatroom.id}.v2`);
        
        channel.bind('App\\Events\\ChatMessageEvent', (data) => {
          const newMessage = {
            id: data.id,
            username: data.sender.username,
            color: data.sender.identity.color || '#999999',
            text: data.content,
            badges: data.sender.identity.badges || [],
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
