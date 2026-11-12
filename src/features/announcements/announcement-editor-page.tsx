import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { TextField } from '../../components/ui/text-field';
import { PostContent } from '../../components/ui/post-content';
import { RequestState, SaveStatus } from '../../components/ui/request-state';
import { ApiError } from '../../lib/api-error';
import { buildLinkTag, isSafeUrl } from '../../lib/post-content';
import { useSaveAction } from '../../lib/use-save-action';
import { createAnnouncement, updateAnnouncement, uploadImage, type Post } from './api';
import { useAnnouncement, useRefreshAnnouncements } from './queries';

export function AnnouncementEditorPage() {
  const { id } = useParams();
  return id ? <ExistingEditor id={id} /> : <Editor />;
}
function ExistingEditor({ id }: { id: string }) {
  const query = useAnnouncement(id);
  return (
    <>
      <Link className="back-link" to="/announcements">
        ← 공지사항 목록
      </Link>
      <RequestState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {query.data?.type === 'ANNOUNCEMENT' && <Editor key={id} post={query.data} />}
    </>
  );
}
function Editor({ post }: { post?: Post }) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [contents, setContents] = useState(post?.contents ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [insertion, setInsertion] = useState<'btn' | 'link' | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [checkedList, setCheckedList] = useState(false);
  const action = useSaveAction();
  const titleError =
    errors.title ??
    (['POST_400_0001', 'POST_400_0002'].includes(action.code)
      ? '제목을 1~100자로 입력해 주세요'
      : undefined);
  const contentsError =
    errors.contents ?? (action.code === 'POST_400_0003' ? '본문을 입력해 주세요' : undefined);
  const upload = useSaveAction();
  const refresh = useRefreshAnnouncements();
  const navigate = useNavigate();
  const allowLeave = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const dirty = title !== (post?.title ?? '') || contents !== (post?.contents ?? '');
  const blocker = useBlocker(
    () => !allowLeave.current && (dirty || action.pending || upload.pending),
  );
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty && !allowLeave.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);
  useEffect(() => {
    if (action.code !== 'POST_400_0003') return;
    const frame = window.requestAnimationFrame(() => {
      setTab('write');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [action.code]);
  useEffect(() => {
    if (action.code === 'POST_400_0003' && tab === 'write') bodyInput.current?.focus();
  }, [action.code, tab]);
  const handleAppend = (value: string) =>
    setContents((current) => `${current}${current ? '\n' : ''}${value}`);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{post ? '공지 수정' : '공지 등록'}</h1>
          <p>
            {post ? '수정은 알림을 다시 보내지 않아요' : '등록하면 모든 사용자에게 알림이 발송돼요'}
          </p>
        </div>
        <Link className="button" to="/announcements">
          목록으로
        </Link>
      </div>
      <form
        ref={form}
        noValidate
        aria-busy={action.pending}
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (unknown || upload.pending) return;
          const next: Record<string, string> = {};
          if (!title.trim()) next.title = '제목을 입력해 주세요';
          else if (title.length > 100) next.title = '제목은 100자까지 입력해 주세요';
          if (!contents.trim()) next.contents = '본문을 입력해 주세요';
          setErrors(next);
          if (next.contents) {
            setTab('write');
            window.requestAnimationFrame(() => bodyInput.current?.focus());
          }
          if (Object.keys(next).length) return;
          void action.run(async () => {
            let id = post?.id;
            try {
              if (post) await updateAnnouncement(post.id, title, contents);
              else id = (await createAnnouncement(title, contents)).id;
            } catch (cause) {
              if (!post && cause instanceof ApiError && cause.status === 0) setUnknown(true);
              if (cause instanceof ApiError && cause.status === 404) await refresh();
              throw cause;
            }
            await refresh();
            allowLeave.current = true;
            void navigate(`/announcements/${id}`, {
              replace: true,
              state: { notice: '저장했어요' },
            });
          });
        }}
      >
        <TextField
          label="제목"
          value={title}
          description={`${title.length} / 100자`}
          error={titleError}
          readOnly={action.pending}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div
          className="editor-tabs"
          role="tablist"
          aria-label="편집기 보기"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? 'write'
                : event.key === 'End'
                  ? 'preview'
                  : tab === 'write'
                    ? 'preview'
                    : 'write';
            setTab(next);
            document.getElementById(`editor-${next}-tab`)?.focus();
          }}
        >
          <Button
            id="editor-write-tab"
            aria-controls="editor-write-panel"
            tabIndex={tab === 'write' ? 0 : -1}
            role="tab"
            aria-selected={tab === 'write'}
            onClick={() => setTab('write')}
          >
            작성
          </Button>
          <Button
            id="editor-preview-tab"
            aria-controls="editor-preview-panel"
            tabIndex={tab === 'preview' ? 0 : -1}
            role="tab"
            aria-selected={tab === 'preview'}
            onClick={() => setTab('preview')}
          >
            미리보기
          </Button>
        </div>
        <div className="editor" data-tab={tab}>
          <section
            className="editor-write stack"
            id="editor-write-panel"
            role="tabpanel"
            aria-label="작성"
          >
            <div className="toolbar row">
              <label
                className="button upload-button"
                aria-disabled={action.pending || upload.pending}
              >
                이미지 삽입
                <input
                  aria-label="이미지 삽입"
                  type="file"
                  accept="image/*"
                  disabled={action.pending || upload.pending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      upload.setError('이미지 파일을 선택해 주세요');
                      return;
                    }
                    void upload.run(async () => {
                      const result = await uploadImage(file);
                      if (!isSafeUrl(result.url) || /[\]\r\n]/.test(result.url))
                        throw new ApiError(0);
                      handleAppend(`[img:${result.url}]`);
                    }, '이미지를 삽입했어요');
                  }}
                />
              </label>
              <Button
                aria-disabled={action.pending}
                onClick={() => {
                  if (!action.pending) setInsertion('btn');
                }}
              >
                버튼 삽입
              </Button>
              <Button
                aria-disabled={action.pending}
                onClick={() => {
                  if (!action.pending) setInsertion('link');
                }}
              >
                링크 삽입
              </Button>
            </div>
            <p role="status">{upload.pending ? '이미지 업로드 중이에요…' : upload.notice}</p>
            {upload.error && (
              <p role="alert">
                이미지를 삽입하지 못했어요. 이미지 파일을 확인하고 다시 시도해 주세요
              </p>
            )}
            <div className="field">
              <label htmlFor="post-contents">본문</label>
              <textarea
                ref={bodyInput}
                id="post-contents"
                value={contents}
                rows={16}
                readOnly={action.pending}
                aria-invalid={!!contentsError}
                aria-describedby="contents-help"
                onChange={(event) => setContents(event.target.value)}
              />
              <p id="contents-help" role={contentsError ? 'alert' : undefined}>
                {contentsError ?? '줄바꿈과 이미지·버튼·링크 태그를 사용할 수 있어요'}
              </p>
            </div>
            {contents.length > 10000 && (
              <p className="note" role="status">
                본문이 10,000자를 넘었어요. 긴 본문도 저장할 수 있어요.
              </p>
            )}
          </section>
          <section
            className="preview card"
            id="editor-preview-panel"
            role="tabpanel"
            aria-label="미리보기"
          >
            <h2>미리보기</h2>
            <h3>{title || '제목'}</h3>
            <PostContent contents={contents} />
          </section>
        </div>
        {unknown ? (
          <section className="note" role="alert">
            <h2>저장됐는지 확인할 수 없어요</h2>
            <p>
              목록에서 등록 여부를 확인한 뒤 다시 등록해 주세요. 작성 내용은 그대로 남아 있어요.
            </p>
            <a
              className="button"
              href="/announcements"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setCheckedList(true)}
            >
              목록 확인 (새 탭)
            </a>
            {checkedList && (
              <Button
                onClick={() => {
                  setUnknown(false);
                  action.setError('');
                }}
              >
                목록을 확인했어요. 다시 등록
              </Button>
            )}
          </section>
        ) : (
          <SaveStatus {...action} />
        )}
        {action.error === '이미 삭제됐어요' && <Link to="/announcements">목록 확인</Link>}
        <div className="actions">
          <Link className="button" to={post ? `/announcements/${post.id}` : '/announcements'}>
            취소
          </Link>
          <Button
            className="primary"
            type="submit"
            aria-disabled={action.pending || upload.pending || unknown}
          >
            {action.pending ? '저장 중…' : post ? '저장' : '등록하고 알림 보내기'}
          </Button>
        </div>
      </form>
      <Dialog
        open={insertion !== null}
        title={insertion === 'btn' ? '버튼 삽입' : '링크 삽입'}
        onClose={() => setInsertion(null)}
      >
        {insertion && (
          <LinkInsert
            kind={insertion}
            onInsert={(value) => {
              handleAppend(value);
              setInsertion(null);
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={blocker.state === 'blocked'}
        title="작성 중인 내용을 두고 나갈까요?"
        initialFocus="cancel"
        onClose={() => {
          if (blocker.state === 'blocked') blocker.reset();
        }}
      >
        <p>저장하지 않은 내용은 사라져요</p>
        <Button
          onClick={() => {
            if (blocker.state === 'blocked') blocker.proceed();
          }}
        >
          나가기
        </Button>
      </Dialog>
    </div>
  );
}
function LinkInsert({
  kind,
  onInsert,
}: {
  kind: 'btn' | 'link';
  onInsert: (value: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const tag = buildLinkTag(kind, label, url);
        setInvalid(!tag);
        if (tag) onInsert(tag);
      }}
    >
      <TextField
        label="라벨"
        value={label}
        error={
          invalid && (!label.trim() || /[\]|]/.test(label))
            ? '라벨을 입력해 주세요. ]와 |는 쓸 수 없어요'
            : undefined
        }
        onChange={(event) => setLabel(event.target.value)}
      />
      <TextField
        label="주소"
        value={url}
        error={invalid ? 'http 또는 https 주소를 입력해 주세요' : undefined}
        onChange={(event) => setUrl(event.target.value)}
      />
      <Button type="submit">삽입</Button>
    </form>
  );
}
