import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

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
  const [settings, setSettings] = useState({ animation: 'slide', textSize: 'medium', textShadow: 'small' });

  useEffect(() => {
    if (!router.isReady) return;
    setSettings({
      animation: router.query.animation || 'slide',
      textSize: router.query.textSize || 'medium',
      textShadow: router.query.textShadow || 'small'
    });
  }, [router.isReady, router.query]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => [...prev.slice(-49), {
        id: Date.now() + Math.random(),
        username: 'Viewer' + Math.floor(Math.random() * 100),
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        text: 'Test message with animation!',
      }]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const sizeClasses = { small: 'text-base', medium: 'text-lg', large: 'text-xl' };
  const shadowClasses = { none: '', small: 'text-shadow-sm', medium: 'text-shadow-md', large: 'text-shadow-lg' };

  return (
    <>
      <Head><title>Kick Chat Overlay</title></Head>
      <div className="min-h-screen w-full">
        <div className={`absolute bottom-0 left-0 w-full overflow-hidden ${sizeClasses[settings.textSize]} text-white`}>
          {messages.map((msg, index) => (
            <AnimatedMessage key={msg.id} animate={settings.animation === 'slide' && index === messages.length - 1}>
              <div className="m-1">
                <span className={`font-bold ${shadowClasses[settings.textShadow]}`} style={{ color: msg.color }}>{msg.username}</span>
                <span className={shadowClasses[settings.textShadow]}>: </span>
                <span className={`break-words ${shadowClasses[settings.textShadow]}`}>{msg.text}</span>
              </div>
            </AnimatedMessage>
          ))}
        </div>
      </div>
    </>
  );
}
