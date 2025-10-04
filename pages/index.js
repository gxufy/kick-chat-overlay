import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// ChatIS Animation Component
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
        <div 
          ref={auxRef}
          style={{ 
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none'
          }}
        >
          {children}
        </div>
        
        <div
          ref={animRef}
          style={{
            height: '0px',
            overflow: 'hidden',
            transition: 'height 150ms ease-in-out'
          }}
        />
      </>
    );
  }

  return <>{children}</>;
}

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
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

  // Demo: Simulate messages
  useEffect(() => {
    const demoMessages = [
      'Hello chat!',
      'This animation is smooth',
      'ChatIS style animation working',
      'Perfect for OBS',
    ];
    
    let index = 0;
    const interval = setInterval(() => {
      const msg = {
        id: Date.now() + Math.random(),
        username: 'Viewer' + Math.floor(Math.random() * 100),
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        text: demoMessages[index % demoMessages.length],
        badges: [],
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev.slice(-49), msg]);
      index++;
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    small: 'text-base',
    medium: 'text-lg',
    large: 'text-xl'
  };

  const shadowClasses = {
    none: '',
    small: 'text-shadow-sm',
    medium: 'text-shadow-md',
    large: 'text-shadow-lg'
  };

  return (
    <>
      <Head>
        <title>Kick Chat Overlay</title>
        <meta name="description" content="Kick chat overlay with animations" />
      </Head>

      <div className="min-h-screen w-full bg-transparent">
        <div className={`absolute bottom-0 left-0 w-full overflow-hidden ${sizeClasses[settings.textSize]} text-white`}>
          {messages.map((msg, index) => (
            <AnimatedMessage 
              key={msg.id}
              animate={settings.animation === 'slide' && index === messages.length - 1}
            >
              <div className={`m-1 ${settings.animation === 'fade' && 'animate-fade'}`}>
                <span 
                  className={`font-bold ${shadowClasses[settings.textShadow]}`}
                  style={{ color: msg.color }}
                >
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
