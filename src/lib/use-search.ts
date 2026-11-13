import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get('query') ?? '';
  const [input, setInput] = useState(query);
  const [previousQuery, setPreviousQuery] = useState(query);
  const [composing, setComposing] = useState(false);
  if (previousQuery !== query) {
    setPreviousQuery(query);
    setInput(query);
  }
  useEffect(() => {
    if (composing || input === query) return;
    const timeout = setTimeout(() => {
      setParams(input ? { query: input } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(timeout);
  }, [input, query, composing, setParams]);
  return {
    query,
    input,
    setInput,
    setComposing,
    clear: () => {
      setInput('');
      setParams({}, { replace: true });
    },
  };
}
