import { serverLabels, type ServerId } from '../../lib/server';
import type { Notice } from './session';

const name = (server: ServerId) => serverLabels[server];

export const authCopy = {
  serverGroup: '접속 서버',
  serverSuffix: ' 서버',
  signingIn: (server: ServerId) => `${name(server)} 서버에 로그인 중이에요…`,
  notices: {
    expired: (server) => `${name(server)} 서버 세션이 만료됐어요`,
    forbidden: (server) => `${name(server)} 서버의 관리자 계정이 아니에요`,
    failed: (server) =>
      `${name(server)} 서버에 로그인하지 못했어요. Google 로그인을 다시 눌러 주세요`,
    offline: (server) => `${name(server)} 서버에 연결하지 못했어요`,
    'logout-failed': (server) =>
      `${name(server)} 서버 로그아웃 요청을 완료하지 못했어요. 다시 시도해 주세요`,
  } satisfies Record<Notice, (server: ServerId) => string>,
  retry: '다시 시도',
  logoutRetry: '로그아웃 다시 시도',
  gisFailed: 'Google 로그인을 불러오지 못했어요. 다시 시도해 주세요',
  gisMissing: 'Google 로그인 설정이 필요해요',
  deniedTitle: '접근 권한이 없어요',
  deniedBody: (server: ServerId) =>
    `${name(server)} 서버의 관리자 권한을 확인한 뒤 다시 로그인해 주세요`,
  signInAgain: '다시 로그인',
};
