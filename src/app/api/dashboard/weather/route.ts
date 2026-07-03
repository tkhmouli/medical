import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/api-response';

/**
 * In-memory weather cache with 30-minute TTL.
 */
interface WeatherCache {
  data: { temperature: number; condition: string; icon: string };
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let weatherCache: WeatherCache | null = null;

/**
 * Checks if the cached data is still valid (within TTL).
 */
function isCacheValid(): boolean {
  if (!weatherCache) return false;
  return Date.now() - weatherCache.timestamp < CACHE_TTL_MS;
}

/**
 * Fetches weather data from OpenWeatherMap free tier API.
 */
async function fetchWeatherFromApi(): Promise<{
  temperature: number;
  condition: string;
  icon: string;
} | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    console.warn('OPENWEATHERMAP_API_KEY is not configured');
    return null;
  }

  const city = process.env.WEATHER_CITY || 'London';
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    console.warn(`OpenWeatherMap API returned status ${response.status}`);
    return null;
  }

  const data = await response.json();

  return {
    temperature: Math.round(data.main.temp),
    condition: data.weather[0].description,
    icon: data.weather[0].icon,
  };
}

/**
 * GET /api/dashboard/weather — Weather data proxy
 * Accessible to: Doctor, Medical_Assistant
 *
 * Proxies weather data from OpenWeatherMap with server-side caching (30-min TTL).
 * Returns current temperature, condition, and icon on success.
 * Returns null data with a message on failure.
 */
export const GET = withAuth(async (_request: AuthenticatedRequest) => {
  // Return cached data if still valid
  if (isCacheValid() && weatherCache) {
    return NextResponse.json(successResponse(weatherCache.data));
  }

  try {
    const weatherData = await fetchWeatherFromApi();

    if (!weatherData) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Weather data unavailable',
      });
    }

    // Update cache
    weatherCache = {
      data: weatherData,
      timestamp: Date.now(),
    };

    return NextResponse.json(successResponse(weatherData));
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({
      success: true,
      data: null,
      message: 'Weather data unavailable',
    });
  }
});
