import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WeatherBadgeProps {
  weatherSnapshot: Record<string, unknown> | null;
}

type WeatherIconName = keyof typeof Ionicons.glyphMap;

function getWeatherIcon(condition: string): WeatherIconName {
  const lower = condition.toLowerCase();
  if (lower.includes('clear') || lower.includes('sunny')) return 'sunny';
  if (lower.includes('cloud') && lower.includes('part')) return 'partly-sunny';
  if (lower.includes('cloud') || lower.includes('overcast')) return 'cloudy';
  if (lower.includes('rain') || lower.includes('drizzle')) return 'rainy';
  if (lower.includes('thunder') || lower.includes('storm')) return 'thunderstorm';
  if (lower.includes('snow')) return 'snow';
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze'))
    return 'cloudy';
  if (lower.includes('wind')) return 'flag';
  return 'partly-sunny';
}

function getWeatherColor(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes('clear') || lower.includes('sunny')) return '#D6B07A';
  if (lower.includes('rain') || lower.includes('storm')) return '#5C6BC0';
  if (lower.includes('cloud')) return '#78909C';
  return '#D6B07A';
}

export default function WeatherBadge({ weatherSnapshot }: WeatherBadgeProps) {
  if (!weatherSnapshot) return null;

  const temp = weatherSnapshot.temp_f as number | undefined;
  const tempC = weatherSnapshot.temp_c as number | undefined;
  const condition =
    (weatherSnapshot.condition as string) ??
    (weatherSnapshot.description as string) ??
    '';
  const windMph = weatherSnapshot.wind_mph as number | undefined;

  // Need at least temperature or condition to show anything useful
  if (temp == null && tempC == null && !condition) return null;

  const displayTemp =
    temp != null ? `${Math.round(temp)}°F` : tempC != null ? `${Math.round(tempC)}°C` : '';
  const iconName = getWeatherIcon(condition);
  const iconColor = getWeatherColor(condition);

  // Build a short description
  const parts: string[] = [];
  if (condition) {
    // Capitalize first letter
    parts.push(condition.charAt(0).toUpperCase() + condition.slice(1));
  }
  if (windMph != null && windMph > 10) {
    parts.push(`${Math.round(windMph)} mph wind`);
  }
  const description = parts.join(', ');

  return (
    <View className="flex-row items-center bg-surface rounded-full px-3.5 py-2 border border-stroke">
      <Ionicons name={iconName} size={18} color={iconColor} />
      {displayTemp ? (
        <Text className="text-sm font-semibold text-charcoal ml-1.5">
          {displayTemp}
        </Text>
      ) : null}
      {description ? (
        <Text className="text-xs text-charcoal/60 ml-1.5" numberOfLines={1}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}
