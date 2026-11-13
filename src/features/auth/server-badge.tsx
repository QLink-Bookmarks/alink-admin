import { serverLabels, type ServerId } from '../../lib/server';
import { authCopy } from './copy';

export function ServerBadge({ server }: { server: ServerId }) {
  return (
    <span className="server-badge" data-server={server}>
      {serverLabels[server]}
      <span className="sr-only">{authCopy.serverSuffix}</span>
    </span>
  );
}
