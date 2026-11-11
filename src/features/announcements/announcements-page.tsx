import { PostList } from '../../components/ui/post-list';
import { useSearch } from '../../lib/use-search';
import { useAnnouncements } from './queries';

export function AnnouncementsPage() {
  const search = useSearch();
  const query = useAnnouncements(search.query);
  return (
    <PostList
      search={search}
      items={query.data?.pages.flatMap((page) => page.contents) ?? []}
      pending={query.isPending}
      error={query.error}
      fetchingNext={query.isFetchingNextPage}
      hasNext={query.hasNextPage}
      onRetry={() => void query.refetch()}
      onMore={() => void query.fetchNextPage()}
    />
  );
}
