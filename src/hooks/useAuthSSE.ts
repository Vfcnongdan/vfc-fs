'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AUTH_SERVER_URL, isNestAuthEnabled } from '@/lib/api-config';

export interface OtpEventPayload {
  type: 'otp' | 'otp_fallback';
  otp: string;
  phone?: string;
  challengeId?: string;
  timestamp?: number;
}

export function useAuthSSE(phone?: string) {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [otpEvent, setOtpEvent] = useState<OtpEventPayload | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!isNestAuthEnabled() || typeof window === 'undefined') return;

    // Đóng kết nối cũ nếu có
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const url = new URL(`${AUTH_SERVER_URL}/auth/events`);
      if (phone) url.searchParams.set('phone', phone);

      const es = new EventSource(url.toString());
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      // 1. Nhận sự kiện connected
      es.addEventListener('connected', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.connectionId) {
            setConnectionId(data.connectionId);
          }
        } catch (e) {
          console.error('[SSE] Failed to parse connected event:', e);
        }
      });

      // 2. Nhận sự kiện OTP tức thì (Returning User)
      es.addEventListener('otp', (event: MessageEvent) => {
        try {
          const data: OtpEventPayload = JSON.parse(event.data);
          setOtpEvent(data);
        } catch (e) {
          console.error('[SSE] Failed to parse otp event:', e);
        }
      });

      // 3. Nhận sự kiện OTP Fallback 15s
      es.addEventListener('otp_fallback', (event: MessageEvent) => {
        try {
          const data: OtpEventPayload = JSON.parse(event.data);
          setOtpEvent(data);
        } catch (e) {
          console.error('[SSE] Failed to parse otp_fallback event:', e);
        }
      });

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Tự động thử kết nối lại sau 3 giây
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('[SSE] Error setting up EventSource:', err);
    }
  }, [phone]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect]);

  const resetOtpEvent = useCallback(() => {
    setOtpEvent(null);
  }, []);

  return {
    connectionId,
    otpEvent,
    isConnected,
    resetOtpEvent,
  };
}
