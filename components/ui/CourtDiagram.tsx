import React from 'react';
import { View, Text } from 'react-native';

type CourtType = 'open_play' | 'clinic' | 'private';

interface CourtDiagramProps {
  type?: CourtType;
}

const TYPE_CONFIG: Record<CourtType, { netColor: string; label: string }> = {
  open_play: { netColor: '#D95F2B', label: 'OPEN PLAY' },
  clinic: { netColor: '#7BC4E2', label: 'CLINIC' },
  private: { netColor: '#A0A0C0', label: 'PRIVATE' },
};

export default function CourtDiagram({ type = 'open_play' }: CourtDiagramProps) {
  const { netColor, label } = TYPE_CONFIG[type];

  return (
    <View
      style={{
        backgroundColor: '#1A1C24',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '600',
          color: '#8A8FA0',
          letterSpacing: 2,
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        Court Diagram · {label}
      </Text>

      {/* Court container */}
      <View
        style={{
          width: 260,
          height: 130,
          borderWidth: 2,
          borderColor: '#E8C97A',
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#131720',
        }}
      >
        {/* Left side label */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 130,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Left attack line */}
          <View
            style={{
              position: 'absolute',
              left: 43,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: '#8A8FA0',
              opacity: 0.4,
            }}
          />
          <Text style={{ fontSize: 9, color: '#8A8FA0', opacity: 0.6 }}>HOME</Text>
        </View>

        {/* Net (center line) */}
        <View
          style={{
            position: 'absolute',
            left: 129,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: netColor,
          }}
        />
        {/* Net post top */}
        <View
          style={{
            position: 'absolute',
            left: 125,
            top: -4,
            width: 10,
            height: 8,
            borderRadius: 4,
            backgroundColor: netColor,
          }}
        />
        {/* Net post bottom */}
        <View
          style={{
            position: 'absolute',
            left: 125,
            bottom: -4,
            width: 10,
            height: 8,
            borderRadius: 4,
            backgroundColor: netColor,
          }}
        />

        {/* Right side */}
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 130,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Right attack line */}
          <View
            style={{
              position: 'absolute',
              right: 43,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: '#8A8FA0',
              opacity: 0.4,
            }}
          />
          <Text style={{ fontSize: 9, color: '#8A8FA0', opacity: 0.6 }}>AWAY</Text>
        </View>
      </View>
    </View>
  );
}
