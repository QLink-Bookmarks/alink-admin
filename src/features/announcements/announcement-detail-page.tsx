import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { PostContent } from '../../components/ui/post-content';
import { RequestState, SaveStatus } from '../../components/ui/request-state';
import { ApiError } from '../../lib/api-error';
import { formatDate } from '../../lib/format';
import { useSaveAction } from '../../lib/use-save-action';
import { deleteAnnouncement } from './api';
import { announcementKeys, useAnnouncement, useRefreshAnnouncements } from './queries';

export function AnnouncementDetailPage() {
  const { id = '' } = useParams();
  const query = useAnnouncement(id);
  const post = query.data;
  const [confirm, setConfirm] = useState(false);
  const action = useSaveAction();
  const refresh = useRefreshAnnouncements();
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 404)
      void client.invalidateQueries({ queryKey: announcementKeys.lists });
  }, [query.error, client]);
  return (
    <div className="stack">
      <Link className="back-link" to="/announcements">
        ← 공지사항 목록
      </Link>
      <p role="status">{(location.state as { notice?: string } | null)?.notice}</p>
      <RequestState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {post && post.type === 'ANNOUNCEMENT' && (
        <>
          <div className="actions">
            <Link className="button" to={`/announcements/${id}/edit`}>
              수정
            </Link>
            <Button onClick={() => setConfirm(true)}>삭제</Button>
          </div>
          <article className="card document">
            <h1>{post.title}</h1>
            <p className="muted">
              {post.author} · {formatDate(post.createdAt)}
            </p>
            <p className="muted">공지 번호 {post.id}</p>
            <PostContent contents={post.contents} />
          </article>
          <Dialog
            open={confirm}
            title="공지를 삭제할까요?"
            initialFocus="cancel"
            onClose={() => {
              if (!action.pending) setConfirm(false);
            }}
          >
            <p>해당 공지의 인앱 알림도 삭제돼요. 이미 기기에 도착한 푸시는 회수되지 않아요.</p>
            <SaveStatus {...action} />
            <Button
              aria-disabled={action.pending}
              onClick={() =>
                void action.run(async () => {
                  let notice = '삭제했어요';
                  try {
                    await deleteAnnouncement(post.id);
                  } catch (cause) {
                    if (!(cause instanceof ApiError && cause.status === 404)) throw cause;
                    notice = '이미 삭제됐어요';
                  }
                  await refresh();
                  void navigate('/announcements', {
                    replace: true,
                    state: { notice },
                  });
                }, '삭제했어요')
              }
            >
              {action.pending ? '삭제 중…' : '삭제 확인'}
            </Button>
          </Dialog>
        </>
      )}
    </div>
  );
}
