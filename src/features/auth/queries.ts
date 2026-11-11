import { useSyncExternalStore } from 'react';
import { session } from './session';

export const useSession = () => useSyncExternalStore(session.subscribe, session.getSnapshot);
