import type { GameTheme } from '../game/types';

export const themes: GameTheme[] = [
  {
    id: 'sunny-bird',
    name: 'Sunny Bird',
    background: '#80d8ff',
    skyline: '#c5f1ff',
    ground: '#d9a441',
    pipe: '#49b848',
    pipeCap: '#6ed36b',
    character: {
      id: 'sunny-bird',
      name: 'Sunny Bird',
      bodyColor: '#ffd43b',
      wingColor: '#ff9f1c',
      accentColor: '#ff6b35',
      eyeColor: '#1f2937'
    }
  },
  {
    id: 'neon-bat',
    name: 'Neon Bat',
    background: '#171331',
    skyline: '#2d235f',
    ground: '#413256',
    pipe: '#16db93',
    pipeCap: '#49f5bd',
    character: {
      id: 'neon-bat',
      name: 'Neon Bat',
      bodyColor: '#b967ff',
      wingColor: '#01cdfe',
      accentColor: '#fffb96',
      eyeColor: '#ffffff'
    }
  },
  {
    id: 'custom-png',
    name: 'Puri',
    background: '#89ddff',
    skyline: '#d7f6ff',
    ground: '#d9a441',
    pipe: '#49b848',
    pipeCap: '#6ed36b',
    character: {
      id: 'custom-png',
      name: 'Puri',
      bodyColor: '#ffd43b',
      wingColor: '#ff9f1c',
      accentColor: '#ff6b35',
      eyeColor: '#1f2937',
      imageScale: 1.35,
      stripFrameCount: 7,
      preserveAlpha: true,
      animationStrips: {
        idle: '/assets/characters/creature/idle.png',
        flap: '/assets/characters/creature/flap.png',
        peak: '/assets/characters/creature/peak.png',
        fall: '/assets/characters/creature/fall.png',
        dead: '/assets/characters/creature/dead.png'
      }
    }
  },
  {
    id: 'tigu',
    name: 'Tigu',
    background: '#7ec8e8',
    skyline: '#d4f1ff',
    ground: '#c9a227',
    pipe: '#2d8f6f',
    pipeCap: '#44b88a',
    character: {
      id: 'tigu',
      name: 'Tigu',
      bodyColor: '#3d9b8f',
      wingColor: '#b87aff',
      accentColor: '#f5e6a8',
      eyeColor: '#6b4cff',
      imageScale: 1.55,
      stripFrameCount: 7,
      stripAnimate: false,
      stripHeroFrameIndex: 3,
      stripHeroFrameByPose: {
        flap: 0,
        peak: 0
      },
      preserveAlpha: false,
      animationStrips: {
        idle: '/assets/characters/tigu/idle.png',
        flap: '/assets/characters/tigu/flap.png',
        peak: '/assets/characters/tigu/peak.png',
        fall: '/assets/characters/tigu/fall.png',
        dead: '/assets/characters/tigu/dead.png'
      }
    }
  }
];

export const defaultTheme = themes[2] ?? themes[0];

export function getThemeById(themeId: string): GameTheme {
  return themes.find((theme) => theme.id === themeId) ?? defaultTheme;
}

export function getThemeNameByCharacterId(characterId: string): string {
  const theme = themes.find((entry) => entry.character.id === characterId);
  return theme?.name ?? characterId;
}

export function getModeLabel(mode: string): string {
  if (mode === 'cheat' || mode === 'ai') {
    return 'Cheat';
  }

  if (mode === 'agent') {
    return 'Pro Agent';
  }

  return 'Manual';
}
