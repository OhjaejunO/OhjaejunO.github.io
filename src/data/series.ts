export type SeriesCategory = '회고' | 'UE5' | '디지털트윈' | 'AI' | '도구';

export interface SeriesMeta {
  slug: string;
  name: string;
  description: string;
  category: SeriesCategory;
}

/**
 * 등록된 시리즈 메타데이터.
 *
 * 시리즈에 글을 추가하려면:
 * 1. 글의 frontmatter에 `series: "slug"` 추가
 * 2. (선택) 새 슬러그라면 여기에 등록해 이름/설명/카테고리 지정
 *    등록하지 않으면 슬러그를 이름으로 그대로 사용함.
 */
export const SERIES_META: Record<string, SeriesMeta> = {
  'wp-4th': {
    slug: 'wp-4th',
    name: 'Apex Legends Mock — WP_4th 회고',
    description:
      'UE5 멀티플레이어 FPS를 처음부터 끝까지 만들면서 부딪힌 네트워킹·GAS·UMG 이슈와 해결 과정을 시리즈로 정리합니다.',
    category: '회고',
  },
  'split-second': {
    slug: 'split-second',
    name: 'Split/Second Mock 회고',
    description:
      'Chaos Vehicles로 아케이드 레이싱 차량 물리를 만든 과정. Power Play 이벤트 시스템을 모킹하면서 배운 것들.',
    category: '회고',
  },
  dtf: {
    slug: 'dtf',
    name: 'DigitalTwinFactory 일지',
    description:
      '실제 공정 라인을 가상 환경으로 옮기는 작업 일지. MQTT·WebSocket 실시간 스트리밍과 시뮬레이션 통합 기록.',
    category: '디지털트윈',
  },
  'ue5-digital-twin': {
    slug: 'ue5-digital-twin',
    name: 'UE5 디지털 트윈 실전 가이드',
    description:
      'UE5 + MQTT + Pixel Streaming으로 스마트 팩토리 디지털 트윈을 처음부터 끝까지 구축하는 시리즈.',
    category: '디지털트윈',
  },
  'ai-native': {
    slug: 'ai-native',
    name: 'AI-Native Dev Workflow',
    description:
      'Hermes Agent · Claude Code · MCP로 1인 개발자가 팀처럼 일하는 워크플로우를 만들어가는 과정.',
    category: 'AI',
  },
};

export function getSeriesMeta(slug: string): SeriesMeta {
  return (
    SERIES_META[slug] ?? {
      slug,
      name: slug,
      description: '',
      category: '도구',
    }
  );
}