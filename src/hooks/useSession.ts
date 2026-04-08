import { useMemo } from 'react';

export interface SessionParams {
  token: string | null;
  student_id: string | null;
  session_id: string | null;
}

export function useSessionParams(): SessionParams {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      token: params.get('token'),
      student_id: params.get('student_id'),
      session_id: params.get('session_id'),
    };
  }, []);
}
