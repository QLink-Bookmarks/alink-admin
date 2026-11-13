export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code = '',
  ) {
    super(
      status === 401
        ? '세션이 만료됐어요'
        : status === 403
          ? '접근 권한이 없어요'
          : '요청을 완료하지 못했어요. 다시 시도해 주세요',
    );
    this.name = 'ApiError';
  }
}
