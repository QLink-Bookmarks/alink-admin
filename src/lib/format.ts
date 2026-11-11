export const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const jsonBody = (value: unknown): RequestInit => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
