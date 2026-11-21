import { NativeModules, Platform } from 'react-native';

export type MeditationTrackId = '432hz' | 'rain' | 'ocean' | 'forest';

export interface MeditationTrack {
  id: MeditationTrackId;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
}

export const MEDITATION_TRACKS: MeditationTrack[] = [
  {
    id: '432hz',
    title: '432 Hz Huzur',
    subtitle: 'Harmonik derin ton',
    icon: '🧘‍♀️',
    accent: '#8B5CF6',
  },
  {
    id: 'rain',
    title: 'Yumuşak Yağmur',
    subtitle: 'Sakinleştirici yağış',
    icon: '🌧️',
    accent: '#0EA5E9',
  },
  {
    id: 'ocean',
    title: 'Okyanus Dalgaları',
    subtitle: 'Ritmik kıyı sesi',
    icon: '🌊',
    accent: '#06B6D4',
  },
  {
    id: 'forest',
    title: 'Tibet Çanı',
    subtitle: 'Meltem & hafif çan',
    icon: '🔔',
    accent: '#EC4899',
  },
];

const NativeMeditationAudio = NativeModules.MeditationAudio as
  | {
      play: (trackId: string, volume: number) => void;
      setVolume: (volume: number) => void;
      stop: () => void;
    }
  | undefined;

class MeditationAudioService {
  public isSupported(): boolean {
    return Platform.OS === 'android' && Boolean(NativeMeditationAudio?.play);
  }

  public play(trackId: MeditationTrackId, volume = 0.65): void {
    if (!this.isSupported()) return;
    try {
      NativeMeditationAudio?.play(trackId, volume);
    } catch {
      // Ignore native audio errors
    }
  }

  public setVolume(volume: number): void {
    if (!this.isSupported()) return;
    try {
      NativeMeditationAudio?.setVolume(volume);
    } catch {
      // Ignore
    }
  }

  public stop(): void {
    if (!this.isSupported()) return;
    try {
      NativeMeditationAudio?.stop();
    } catch {
      // Ignore
    }
  }
}

export const meditationAudioService = new MeditationAudioService();
