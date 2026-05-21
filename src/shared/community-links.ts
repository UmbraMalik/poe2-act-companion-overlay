export const PROJECT_SITE_URL = 'https://umbramalik.github.io/poe2-act-companion-overlay/';
export const PROJECT_TELEGRAM_URL = 'https://t.me/POE2ActCompanion';
export const PROJECT_CHAT_URL = 'https://t.me/POE2ActCompanionChat';
export const PROJECT_FEEDBACK_URL = 'https://t.me/POE2ActCompanion?direct';
export const PROJECT_RELEASES_URL =
  'https://github.com/UmbraMalik/poe2-act-companion-overlay/releases';
export const PROJECT_REPOSITORY_URL =
  'https://github.com/UmbraMalik/poe2-act-companion-overlay';
export const PROJECT_DONATION_ALERTS_URL =
  'https://www.donationalerts.com/r/umbramalik';

export interface CommunityLinkDefinition {
  title: string;
  description: string;
  url: string;
  action: string;
}

export const COMMUNITY_LINKS: CommunityLinkDefinition[] = [
  {
    title: 'Сайт проекта',
    description: 'Описание, демо, установка и актуальная версия.',
    url: PROJECT_SITE_URL,
    action: 'Открыть сайт'
  },
  {
    title: 'Telegram',
    description: 'Новости, релизы и важные объявления по overlay.',
    url: PROJECT_TELEGRAM_URL,
    action: 'Открыть канал'
  },
  {
    title: 'Чат проекта',
    description: 'Вопросы, обсуждение, помощь с установкой и живой фидбек.',
    url: PROJECT_CHAT_URL,
    action: 'Открыть чат'
  },
  {
    title: 'Обратная связь',
    description: 'Баги, ошибки в данных, предложения и скриншоты проблем.',
    url: PROJECT_FEEDBACK_URL,
    action: 'Написать'
  },
  {
    title: 'GitHub Releases',
    description: 'Последние сборки, installer .exe и история релизов.',
    url: PROJECT_RELEASES_URL,
    action: 'Открыть релизы'
  },
  {
    title: 'Исходный код',
    description: 'Открытый код проекта: можно посмотреть, проверить и собрать самому.',
    url: PROJECT_REPOSITORY_URL,
    action: 'Открыть GitHub'
  }
];
