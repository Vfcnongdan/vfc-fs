"use client";

import { useState, useEffect } from "react";

interface WeatherData {
  temperature: number;
  weathercode: number;
  windspeed: number;
  humidity: number;
}

const WMO_ICONS: Record<number, { icon: string; label: string }> = {
  0: { icon: "☀️", label: "Trời quang" },
  1: { icon: "🌤️", label: "Ít mây" },
  2: { icon: "⛅", label: "Có mây" },
  3: { icon: "☁️", label: "Nhiều mây" },
  45: { icon: "🌫️", label: "Sương mù" },
  48: { icon: "🌫️", label: "Sương mù" },
  51: { icon: "🌦️", label: "Mưa phùn" },
  53: { icon: "🌦️", label: "Mưa phùn" },
  55: { icon: "🌦️", label: "Mưa phùn" },
  61: { icon: "🌧️", label: "Mưa nhẹ" },
  63: { icon: "🌧️", label: "Mưa vừa" },
  65: { icon: "🌧️", label: "Mưa to" },
  71: { icon: "❄️", label: "Tuyết nhẹ" },
  73: { icon: "❄️", label: "Tuyết vừa" },
  75: { icon: "❄️", label: "Tuyết dày" },
  80: { icon: "🌦️", label: "Mưa rào" },
  81: { icon: "🌧️", label: "Mưa rào" },
  82: { icon: "⛈️", label: "Mưa rào lớn" },
  95: { icon: "⛈️", label: "Dông" },
  96: { icon: "⛈️", label: "Dông có mưa đá" },
  99: { icon: "⛈️", label: "Dông mưa đá lớn" },
};

function getWeatherInfo(code: number) {
  const exact = WMO_ICONS[code];
  if (exact) return exact;
  // fallback by range
  if (code <= 3) return WMO_ICONS[code] ?? WMO_ICONS[0];
  if (code <= 55) return WMO_ICONS[51];
  if (code <= 65) return WMO_ICONS[61];
  if (code <= 82) return WMO_ICONS[80];
  return WMO_ICONS[95];
}

export function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [city, setCity] = useState<string>("Vị trí của bạn");
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      fetchWeather(10.8231, 106.6297, "TP. Hồ Chí Minh"); // default HCM
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode with open-meteo's geocoding (no key needed)
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=vi`
          );
          const geoData = await geoRes.json();
          const name =
            geoData.address?.city ||
            geoData.address?.town ||
            geoData.address?.county ||
            geoData.address?.state ||
            "Vị trí của bạn";
          setCity(name);
        } catch {
          // ignore geo name error
        }
        fetchWeather(latitude, longitude);
      },
      () => fetchWeather(10.8231, 106.6297, "TP. Hồ Chí Minh")
    );
  }, []);

  async function fetchWeather(lat: number, lon: number, fallbackCity?: string) {
    if (fallbackCity) setCity(fallbackCity);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relativehumidity_2m,weathercode,windspeed_10m&timezone=auto`
      );
      const data = await res.json();
      const c = data.current;
      setWeather({
        temperature: Math.round(c.temperature_2m),
        weathercode: c.weathercode,
        windspeed: Math.round(c.windspeed_10m),
        humidity: c.relativehumidity_2m,
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  const info = weather ? getWeatherInfo(weather.weathercode) : null;

  return (
    <div
      className="z-40 sm:bottom-4"
      style={{ maxWidth: "calc(100vw - 32px)", width: "min(640px, 100%)" }}
    >
      <div
        className="relative flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-md border border-vfc-green/15 overflow-hidden bg-vfc-mint"
      >
        {loading ? (
          <div className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-full bg-vfc-green/10 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-vfc-green/10 animate-pulse" />
              <div className="h-2 w-16 rounded bg-vfc-green/10 animate-pulse" />
            </div>
          </div>
        ) : weather && info ? (
          <div className="flex items-center gap-3 w-full min-w-0">
            {/* Icon + temp */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-2xl leading-none">{info.icon}</span>
              <span className="text-2xl font-black text-vfc-green leading-none">
                {weather.temperature}°
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-vfc-green/20 shrink-0" />

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-vfc-green truncate leading-tight">
                {city}
              </p>
              <p className="text-[10px] text-vfc-green/70 leading-tight mt-0.5">
                {info.label} · 💧{weather.humidity}% · 🌬️{weather.windspeed} km/h
              </p>
            </div>

            {/* Close */}
            <button
              onClick={() => setVisible(false)}
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-800 hover:bg-black/5 transition-colors text-xs leading-none"
              aria-label="Đóng thời tiết"
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
