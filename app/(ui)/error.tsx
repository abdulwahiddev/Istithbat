'use client';

import { ErrorState } from '@/components/states/States';

/** Last-resort boundary for unexpected render errors. Read failures are handled in each page. */
export default function UiError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="ist-content">
      <ErrorState title="This screen could not be displayed" message="An unexpected error occurred while rendering. Nothing was changed.">
        <div>
          <button className="ist-btn" type="button" onClick={reset}>
            Try again
          </button>
        </div>
      </ErrorState>
    </main>
  );
}
