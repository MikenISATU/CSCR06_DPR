"use client";

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from './supbase';

export default function LoginPage(): React.ReactElement {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockoutTimestamp, setLockoutTimestamp] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [lastAttemptDate, setLastAttemptDate] = useState<string | null>(null);
  const [clickCount, setClickCount] = useState<number>(0);
  const [showQuote, setShowQuote] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const pingSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('users2')
          .select('id')
          .limit(1);
        if (error) {
          console.error('Error pinging Supabase:', error.message);
        } else {
          console.log('Successfully pinged Supabase:', data);
        }
      } catch (err) {
        console.error('Unexpected error during Supabase ping:', err instanceof Error ? err.message : String(err));
      }
    };
    pingSupabase();
  }, []);

  useEffect(() => {
    const savedCredentials = localStorage.getItem('scanflow360_credentials');
    if (savedCredentials) {
      const { username: savedUsername, password: savedPassword } = JSON.parse(savedCredentials);
      setUsername(savedUsername || '');
      setPassword(savedPassword || '');
      setRememberMe(true);
    }

    const rateLimitState = localStorage.getItem('scanflow360_rate_limit');
    if (rateLimitState) {
      const { attempts, locked, timestamp, lastAttemptDate } = JSON.parse(rateLimitState);
      const currentTime = Date.now();
      const lockoutDuration = 5 * 60 * 1000;
      const currentDate = new Date().toDateString();

      if (lastAttemptDate && lastAttemptDate !== currentDate) {
        resetRateLimit();
      } else {
        if (locked && timestamp) {
          const elapsedTime = currentTime - timestamp;
          if (elapsedTime < lockoutDuration) {
            setIsLocked(true);
            setLoginAttempts(attempts || 0);
            setLockoutTimestamp(timestamp);
            setRemainingTime(Math.floor((lockoutDuration - elapsedTime) / 1000));
            setLastAttemptDate(lastAttemptDate || currentDate);
          } else {
            resetRateLimit();
          }
        } else {
          setLoginAttempts(attempts || 0);
          setIsLocked(false);
          setLockoutTimestamp(null);
          setRemainingTime(0);
          setLastAttemptDate(lastAttemptDate || currentDate);
        }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('scanflow360_rate_limit', JSON.stringify({
      attempts: loginAttempts,
      locked: isLocked,
      timestamp: lockoutTimestamp,
      lastAttemptDate: lastAttemptDate || new Date().toDateString(),
    }));
  }, [loginAttempts, isLocked, lockoutTimestamp, lastAttemptDate]);

  useEffect(() => {
    if (isLocked && lockoutTimestamp) {
      const lockoutDuration = 5 * 60 * 1000;
      const updateTimer = () => {
        const currentTime = Date.now();
        const elapsedTime = currentTime - lockoutTimestamp;
        const remaining = Math.max(0, Math.floor((lockoutDuration - elapsedTime) / 1000));
        setRemainingTime(remaining);
        if (remaining <= 0) {
          resetRateLimit();
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [isLocked, lockoutTimestamp]);

  useEffect(() => {
    let clickTimeout: NodeJS.Timeout | null = null;
    let lastEventTime: number = 0;
    const debounceTime = 50;

    const handleClick = (event: Event) => {
      const currentTime = Date.now();
      if (currentTime - lastEventTime < debounceTime) {
        return;
      }
      lastEventTime = currentTime;

      setClickCount(prev => prev + 1);
      if (clickTimeout) clearTimeout(clickTimeout);

      clickTimeout = setTimeout(() => {
        setClickCount(0);
      }, 1000);

      if (clickCount + 1 === 60) {
        setShowQuote(true);
        setClickCount(0);
      }
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleClick);

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleClick);
      if (clickTimeout) clearTimeout(clickTimeout);
    };
  }, [clickCount]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const resetRateLimit = () => {
    setIsLocked(false);
    setLoginAttempts(0);
    setLockoutTimestamp(null);
    setRemainingTime(0);
    setLastAttemptDate(new Date().toDateString());
    localStorage.setItem('scanflow360_rate_limit', JSON.stringify({
      attempts: 0,
      locked: false,
      timestamp: null,
      lastAttemptDate: new Date().toDateString(),
    }));
  };

  async function handleLogin(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    const rateLimitState = localStorage.getItem('scanflow360_rate_limit');
    if (rateLimitState) {
      const { locked, timestamp, lastAttemptDate } = JSON.parse(rateLimitState);
      const currentDate = new Date().toDateString();

      if (lastAttemptDate && lastAttemptDate !== currentDate) {
        resetRateLimit();
      } else if (locked && timestamp) {
        const elapsedTime = Date.now() - timestamp;
        const lockoutDuration = 5 * 60 * 1000;
        if (elapsedTime < lockoutDuration) {
          alert(`Too many failed attempts. Please wait ${formatTime(Math.floor((lockoutDuration - elapsedTime) / 1000))} before trying again.`);
          return;
        } else {
          resetRateLimit();
        }
      }
    }

    if (isLocked) {
      alert(`Too many failed attempts. Please wait ${formatTime(remainingTime)} before trying again.`);
      return;
    }

    const sanitizedUsername = username.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitizedUsername) {
      alert('Invalid username. Only alphanumeric characters, underscores, and hyphens are allowed.');
      setLoginAttempts(prev => prev + 1);
      setLastAttemptDate(new Date().toDateString());
      if (loginAttempts + 1 >= 5) {
        setIsLocked(true);
        setLockoutTimestamp(Date.now());
        setRemainingTime(5 * 60);
      }
      return;
    }

    if (!password) {
      alert('Password cannot be empty.');
      setLoginAttempts(prev => prev + 1);
      setLastAttemptDate(new Date().toDateString());
      if (loginAttempts + 1 >= 5) {
        setIsLocked(true);
        setLockoutTimestamp(Date.now());
        setRemainingTime(5 * 60);
      }
      return;
    }

    try {
      const { data: users, error } = await supabase
        .from('users2')
        .select('id, username, password, role')
        .eq('username', sanitizedUsername);

      if (error) {
        alert('Error fetching user: ' + error.message);
        setLoginAttempts(prev => prev + 1);
        setLastAttemptDate(new Date().toDateString());
        if (loginAttempts + 1 >= 5) {
          setIsLocked(true);
          setLockoutTimestamp(Date.now());
          setRemainingTime(5 * 60);
        }
        return;
      }

      if (!users || users.length === 0) {
        alert('User not found');
        setLoginAttempts(prev => prev + 1);
        setLastAttemptDate(new Date().toDateString());
        if (loginAttempts + 1 >= 5) {
          setIsLocked(true);
          setLockoutTimestamp(Date.now());
          setRemainingTime(5 * 60);
        }
        return;
      }

      if (users.length > 1) {
        alert('Multiple users found with this username. Please contact support.');
        setLoginAttempts(prev => prev + 1);
        setLastAttemptDate(new Date().toDateString());
        if (loginAttempts + 1 >= 5) {
          setIsLocked(true);
          setLockoutTimestamp(Date.now());
          setRemainingTime(5 * 60);
        }
        return;
      }

      const user = users[0];

      if (user.password !== password) {
        alert('Wrong username or password');
        setLoginAttempts(prev => prev + 1);
        setLastAttemptDate(new Date().toDateString());
        if (loginAttempts + 1 >= 5) {
          setIsLocked(true);
          setLockoutTimestamp(Date.now());
          setRemainingTime(5 * 60);
        }
        return;
      }

      resetRateLimit();

      localStorage.setItem('scanflow360_user', JSON.stringify({
        id: user.id,
        username: user.username,
        role: user.role,
      }));

      if (rememberMe) {
        localStorage.setItem('scanflow360_credentials', JSON.stringify({
          username: sanitizedUsername,
          password: password,
        }));
      } else {
        localStorage.removeItem('scanflow360_credentials');
      }

      if (user.role.toUpperCase() === 'ADMIN') {
        router.push('/adminpage');
      } else {
        router.push('/inputpage');
      }
    } catch (err) {
      alert('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
      setLoginAttempts(prev => prev + 1);
      setLastAttemptDate(new Date().toDateString());
      if (loginAttempts + 1 >= 5) {
        setIsLocked(true);
        setLockoutTimestamp(Date.now());
        setRemainingTime(5 * 60);
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F5] flex flex-col items-center p-4 sm:p-6">
      <div className="mb-6">
        <Image
          src="/logo.png"
          alt="Website Logo"
          width={120}
          height={40}
          priority
          className="w-32 sm:w-40"
        />
      </div>
      <form
        onSubmit={handleLogin}
        className="bg-white rounded-lg shadow-lg p-6 sm:p-8 w-full max-w-sm mt-8 sm:mt-16"
        aria-label="Login Form"
      >
        <h2 className="text-xl sm:text-2xl font-bold text-[#003087] mb-6 font-['Poppins'] text-center">
          Digitization Project Report (Sign In)
        </h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block mb-1 text-sm font-medium text-[#003087]"
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              aria-required="true"
              aria-describedby="login-error"
              disabled={isLocked}
            />
          </div>
          <div className="relative">
            <label
              htmlFor="password"
              className="block mb-1 text-sm font-medium text-[#003087]"
            >
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              aria-required="true"
              aria-describedby="login-error"
              disabled={isLocked}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-9 text-[#003087] hover:text-[#002060] focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isLocked}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {loginAttempts > 0 && (
            <p id="login-error" className="text-xs text-[#C1272D] mt-1">
              {loginAttempts < 5
                ? `Attempts remaining: ${5 - loginAttempts}`
                : `Account locked. Please wait ${formatTime(remainingTime)}`}
            </p>
          )}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mr-2 h-4 w-4 text-[#C8102E] focus:ring-[#C8102E] border-gray-300 rounded accent-[#C8102E]"
              aria-label="Remember me checkbox"
              disabled={isLocked}
            />
            <label
              htmlFor="rememberMe"
              className="text-sm text-[#003087]"
            >
              Remember me
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLocked}
          className={`w-full py-2 mt-6 rounded font-medium text-sm sm:text-base transition-colors ${
            isLocked
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#003087] text-white hover:bg-[#002060]'
          }`}
          aria-label="Login button"
          aria-disabled={isLocked ? "true" : "false"}
        >
          Login
        </button>
        <p className="text-center text-sm text-[#003087] mt-4">
          Don't have an account?{' '}
          <Link href="/registration" className="font-medium hover:text-[#002060] underline">
            Register here
          </Link>
        </p>
      </form>

      {showQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center shadow-lg">
            <h3 className="text-lg font-semibold text-[#003087] mb-4">A Little Encouragement</h3>
            <p className="text-sm text-gray-700 italic">
              Keep going, for you are the past you once prayed to become stronger, wiser, unstoppable.
            </p>
            <p className="text-xs text-gray-500 mt-2">— M.K.N 2025</p>
            <button
              onClick={() => setShowQuote(false)}
              className="mt-4 px-4 py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors text-sm"
              aria-label="Close quote modal"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <footer className="mt-8 text-sm text-gray-600">
        All Rights Reserved by CSC R06 2025
      </footer>
    </div>
  );
}
